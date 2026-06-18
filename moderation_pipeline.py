from __future__ import annotations

import json
import os
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def load_env_file(path: Path = Path(".env")) -> None:
    """Load simple KEY=VALUE pairs for local runs without adding a dependency."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_env_file()

HARM_CATEGORIES = [
    "hate_speech",
    "harassment",
    "spam",
    "misinformation",
    "graphic_violence",
    "adult_content",
    "self_harm",
]
POLICY_PATH = Path(os.getenv("POLICIES_PATH", "config/policies.json"))
PROMPT_PATH = Path(os.getenv("MODERATION_PROMPT_PATH", "config/moderation_prompt.md"))
DB_PATH = Path(os.getenv("MODERATION_DB_PATH", "/tmp/moderation.db" if os.getenv("VERCEL") else "moderation.db"))
SQLITE_TIMEOUT_SECONDS = float(os.getenv("SQLITE_TIMEOUT_SECONDS", "10"))

PLATFORM_ALIASES = {
    "general": "social_media",
    "forKids": "children_app",
    "adult": "adult_discussion_platform",
}


@dataclass
class ModerationInput:
    content: str
    platform: str = "social_media"
    conversation_context: str = ""
    user_history: str = ""


def canonical_platform(platform: str) -> str:
    return PLATFORM_ALIASES.get(platform, platform or "social_media")


def load_policies() -> Dict[str, Any]:
    return json.loads(POLICY_PATH.read_text())


def get_policy(platform: str) -> Dict[str, Any]:
    policies = load_policies()
    platform = canonical_platform(platform)
    return policies.get(platform, policies["social_media"])


def open_db() -> sqlite3.Connection:
    """Open SQLite with settings that are safer for API-style concurrent access."""
    conn = sqlite3.connect(DB_PATH, timeout=SQLITE_TIMEOUT_SECONDS)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn


def init_db() -> None:
    with open_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS moderation_logs(
                id TEXT PRIMARY KEY,
                request_json TEXT NOT NULL,
                response_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS review_queue(
                case_id TEXT PRIMARY KEY,
                response_json TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS moderator_feedback(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                decision TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL
            )
            """
        )


def severity(confidence: float) -> str:
    if confidence >= 0.92:
        return "critical"
    if confidence >= 0.80:
        return "high"
    if confidence >= 0.55:
        return "medium"
    if confidence > 0:
        return "low"
    return "none"


def normalize_ai_result(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize Groq JSON into the pipeline contract.

    The prompt asks for a rich schema, but this also accepts the simpler
    `post_category`/`confidence_score` shape used by earlier implementations.
    """
    categories = {cat: 0.0 for cat in HARM_CATEGORIES}
    raw_categories = raw.get("categories") or raw.get("category_scores") or {}
    if isinstance(raw_categories, dict):
        for cat in HARM_CATEGORIES:
            try:
                categories[cat] = max(0.0, min(1.0, float(raw_categories.get(cat, 0.0))))
            except (TypeError, ValueError):
                categories[cat] = 0.0

    primary = raw.get("primary_category") or raw.get("post_category") or raw.get("category") or "none"
    aliases = {"safe": "none", "self-harm": "self_harm", "hate-speech": "hate_speech", "adult-content": "adult_content"}
    primary = aliases.get(str(primary), str(primary))
    if primary in HARM_CATEGORIES and categories[primary] == 0.0:
        try:
            categories[primary] = max(0.0, min(1.0, float(raw.get("confidence_score", raw.get("confidence", 0.0)))))
        except (TypeError, ValueError):
            categories[primary] = 0.0
    if primary not in HARM_CATEGORIES or categories.get(primary, 0.0) == 0.0:
        primary = max(categories, key=categories.get)
        if categories[primary] == 0.0:
            primary = "none"

    confidence = categories.get(primary, 0.0) if primary != "none" else 0.0
    return {
        "categories": categories,
        "primary_category": primary,
        "severity": raw.get("severity") or severity(confidence),
        "offending_segment": raw.get("offending_segment") or ", ".join(raw.get("flagged_keywords", []) or []),
        "explanation": raw.get("explanation") or raw.get("reasoning") or "Groq returned a structured moderation decision.",
        "context_analysis": raw.get("context_analysis", "Groq prompt considered content, context, user history, and platform policy."),
        "recommended_action": raw.get("recommended_action", "human_review" if confidence >= 0.55 else "allow"),
    }


def groq_classify(inp: ModerationInput, policy: Dict[str, Any]) -> Dict[str, Any]:
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is required for Groq classification")

    client = Groq(api_key=api_key)
    prompt = PROMPT_PATH.read_text()
    payload = {
        "content": inp.content,
        "platform": inp.platform,
        "conversation_context": inp.conversation_context,
        "user_history": inp.user_history,
        "policy": policy,
        "required_categories": HARM_CATEGORIES,
    }
    response = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        temperature=0.1,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps(payload)},
        ],
    )
    raw = json.loads(response.choices[0].message.content or "{}")
    return normalize_ai_result(raw)


def choose_provider() -> str:
    requested = os.getenv("CLASSIFIER_PROVIDER", "groq").strip().lower()
    if requested == "auto":
        return "groq"
    return requested


def route(primary: str, confidence: float, policy: Dict[str, Any]) -> tuple[str, str, bool]:
    if not policy.get("category_toggles", {}).get(primary, True):
        return "allow", "allow", False
    if primary == "none" or confidence < policy.get("review_threshold", 0.55):
        return "allow", "allow", False
    if primary in {"self_harm", "graphic_violence"} and confidence >= policy["thresholds"].get(primary, 0.55):
        return "urgent_escalation", "urgent_escalation", True
    if confidence >= policy.get("auto_action_threshold", 0.88) and confidence >= policy["thresholds"].get(primary, 0.55):
        return "auto_action", "auto_remove", False
    return "human_review", "human_review", True


def moderate(inp: ModerationInput) -> Dict[str, Any]:
    init_db()
    inp.platform = canonical_platform(inp.platform)
    policy = get_policy(inp.platform)
    provider = choose_provider()
    provider_requested = os.getenv("CLASSIFIER_PROVIDER", "groq")

    if provider == "groq":
        ai = groq_classify(inp, policy)
        classifier_provider = "groq_llm"
    else:
        raise ValueError("CLASSIFIER_PROVIDER must be groq or auto")

    scores = {cat: float(ai.get("categories", {}).get(cat, 0.0)) for cat in HARM_CATEGORIES}
    primary = ai.get("primary_category") or max(scores, key=scores.get)
    if primary not in HARM_CATEGORIES or scores.get(primary, 0.0) == 0:
        primary = "none"
    confidence = round(scores.get(primary, 0.0), 2) if primary != "none" else 0.0
    routing, final_decision, review = route(primary, confidence, policy)
    response = {
        "id": str(uuid.uuid4()),
        "final_decision": final_decision,
        "primary_category": primary,
        "confidence": confidence,
        "categories": scores,
        "severity": ai.get("severity") or severity(confidence),
        "offending_segment": ai.get("offending_segment", ""),
        "reasoning": ai.get("explanation", ""),
        "context_analysis": ai.get("context_analysis", ""),
        "policy_applied": f"{inp.platform}.{primary}_threshold = {policy.get('thresholds', {}).get(primary, policy.get('review_threshold'))}",
        "routing": routing,
        "requires_human_review": review,
        "classifier_provider": classifier_provider,
        "provider_requested": provider_requested,
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile") if classifier_provider == "groq_llm" else None,
        "pipeline_trace": [
            {"stage": "input", "detail": "Content and context received."},
            {"stage": "classification", "detail": f"Provider={classifier_provider}; primary={primary}; confidence={confidence}."},
            {"stage": "policy", "detail": f"Applied platform policy: {inp.platform}."},
            {"stage": "routing", "detail": f"Routing={routing}; decision={final_decision}."},
            {"stage": "audit", "detail": "Decision saved to SQLite audit log."},
        ],
    }
    with open_db() as conn:
        conn.execute(
            "INSERT INTO moderation_logs(id, request_json, response_json, created_at) VALUES (?, ?, ?, ?)",
            (response["id"], json.dumps(inp.__dict__), json.dumps(response), datetime.now(timezone.utc).isoformat()),
        )
        if review:
            conn.execute(
                "INSERT INTO review_queue(case_id, response_json, created_at) VALUES (?, ?, ?)",
                (response["id"], json.dumps(response), datetime.now(timezone.utc).isoformat()),
            )
    return response


def list_review_queue() -> List[Dict[str, Any]]:
    init_db()
    with open_db() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT case_id, response_json, status FROM review_queue WHERE status='pending' ORDER BY created_at ASC").fetchall()
    return [{"case_id": row["case_id"], "status": row["status"], "ai_decision": json.loads(row["response_json"])} for row in rows]


def save_review(case_id: str, decision: str, notes: str = "") -> Dict[str, Any]:
    init_db()
    with open_db() as conn:
        row = conn.execute("SELECT response_json FROM review_queue WHERE case_id=?", (case_id,)).fetchone()
        if not row:
            raise KeyError(case_id)
        conn.execute("UPDATE review_queue SET status='reviewed' WHERE case_id=?", (case_id,))
        conn.execute(
            "INSERT INTO moderator_feedback(case_id, decision, notes, created_at) VALUES (?, ?, ?, ?)",
            (case_id, decision, notes, datetime.now(timezone.utc).isoformat()),
        )
    result = json.loads(row[0])
    result["moderator_decision"] = decision
    result["moderator_notes"] = notes
    return result


def run_evaluation() -> Dict[str, Any]:
    cases = [
        ("Buy followers now! Click this link!", "social_media", "spam"),
        ("I will kill you.", "social_media", "harassment"),
        ("The villain in the movie said, 'I will kill you.'", "social_media", "none"),
        ("This post contains explicit nudes.", "children_app", "adult_content"),
        ("Vaccines cause autism, share this truth.", "social_media", "misinformation"),
        ("Just completed my demo.", "social_media", "none"),
    ]
    results = []
    passed = 0
    for content, platform, expected in cases:
        context = "Movie quote discussion." if "villain" in content else ""
        res = moderate(ModerationInput(content=content, platform=platform, conversation_context=context))
        ok = res["primary_category"] == expected or (expected == "none" and res["routing"] == "allow")
        passed += int(ok)
        results.append({"content": content, "expected": expected, "actual": res["primary_category"], "routing": res["routing"], "passed": ok})
    return {"total": len(results), "passed": passed, "failed": len(results) - passed, "results": results}
