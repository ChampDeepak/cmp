from __future__ import annotations

import json
import os
import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

HARM_CATEGORIES = ["hate_speech", "harassment", "spam", "misinformation", "graphic_violence", "adult_content", "self_harm"]
POLICY_PATH = Path(os.getenv("POLICIES_PATH", "config/policies.json"))
PROMPT_PATH = Path(os.getenv("MODERATION_PROMPT_PATH", "config/moderation_prompt.md"))
DB_PATH = Path(os.getenv("MODERATION_DB_PATH", "moderation.db"))

PLATFORM_ALIASES = {"general": "social_media", "forKids": "children_app", "adult": "adult_discussion_platform"}

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


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS moderation_logs(
                id TEXT PRIMARY KEY,
                request_json TEXT NOT NULL,
                response_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS review_queue(
                case_id TEXT PRIMARY KEY,
                response_json TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS moderator_feedback(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                decision TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL
            )
        """)


def local_classify(inp: ModerationInput) -> Dict[str, Any]:
    text = inp.content.lower()
    context = inp.conversation_context.lower()
    scores = {cat: 0.0 for cat in HARM_CATEGORIES}
    segment = ""
    explanation = "No configured harm rule matched."

    rules = [
        ("hate_speech", 0.95, [r"subhuman", r"go back to your country", r"all\s+\w+\s+are\s+animals"], "Targets a protected/group identity."),
        ("harassment", 0.86, [r"fuck\s+off", r"fuck\s+you", r"idiot", r"worthless", r"useless", r"should disappear"], "Targets another person with abusive or degrading language."),
        ("harassment", 0.92, [r"i will kill you", r"i will hurt you"], "Direct threat or intimidation."),
        ("spam", 0.91, [r"buy followers", r"click this link", r"free money", r"limited offer"], "Spam or manipulative promotion."),
        ("misinformation", 0.90, [r"vaccines? cause autism", r"vote by text", r"election is cancelled"], "Potential harmful misinformation."),
        ("graphic_violence", 0.90, [r"blood everywhere", r"gory", r"decapitat", r"guts"], "Graphic violent content."),
        ("adult_content", 0.92, [r"explicit nudes", r"porn", r"sexual content", r"adult joke"], "Adult or sexual content."),
        ("self_harm", 0.96, [r"i want to die", r"kill myself", r"suicide", r"self harm"], "Self-harm or suicidal ideation."),
    ]
    for category, score, patterns, reason in rules:
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                adjusted = score
                if any(word in context for word in ["movie", "quote", "fiction", "joke", "performance"]):
                    adjusted = max(0.20, adjusted - 0.55)
                    reason += " Context suggests quoted/fictional/slang usage, lowering severity."
                if any(word in context for word in ["argument", "bullying", "threat"]):
                    adjusted = min(0.99, adjusted + 0.05)
                    reason += " Conversation context suggests escalation."
                scores[category] = max(scores[category], round(adjusted, 2))
                if adjusted >= max(scores.values()):
                    segment = inp.content[match.start():match.end()]
                    explanation = reason
    primary = max(scores, key=scores.get)
    if scores[primary] == 0:
        primary = "none"
    return {
        "categories": scores,
        "primary_category": primary,
        "severity": severity(scores.get(primary, 0.0)),
        "offending_segment": segment,
        "explanation": explanation,
        "context_analysis": "Context considered by local fallback classifier.",
        "recommended_action": "human_review" if scores.get(primary, 0) >= 0.5 else "allow",
    }


def groq_classify(inp: ModerationInput, policy: Dict[str, Any]) -> Dict[str, Any]:
    from groq import Groq
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is required when CLASSIFIER_PROVIDER=groq")
    client = Groq(api_key=api_key)
    prompt = PROMPT_PATH.read_text()
    payload = {"content": inp.content, "platform": inp.platform, "conversation_context": inp.conversation_context, "user_history": inp.user_history, "policy": policy}
    response = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        temperature=0.1,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": prompt}, {"role": "user", "content": json.dumps(payload)}],
    )
    return json.loads(response.choices[0].message.content or "{}")


def severity(confidence: float) -> str:
    if confidence >= 0.92: return "critical"
    if confidence >= 0.80: return "high"
    if confidence >= 0.55: return "medium"
    if confidence > 0: return "low"
    return "none"


def route(primary: str, confidence: float, policy: Dict[str, Any]) -> tuple[str, str, bool]:
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
    provider = os.getenv("CLASSIFIER_PROVIDER", "local")
    if provider == "groq":
        try:
            ai = groq_classify(inp, policy)
            classifier_provider = "groq_llm"
        except Exception as exc:
            ai = local_classify(inp)
            ai["explanation"] = f"Groq failed; local fallback used. {ai.get('explanation', '')}"
            classifier_provider = "local_fallback"
    else:
        ai = local_classify(inp)
        classifier_provider = "local_config_rules"

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
        "pipeline_trace": [
            {"stage": "input", "detail": "Content and context received."},
            {"stage": "classification", "detail": f"Provider={classifier_provider}; primary={primary}; confidence={confidence}."},
            {"stage": "policy", "detail": f"Applied platform policy: {inp.platform}."},
            {"stage": "routing", "detail": f"Routing={routing}; decision={final_decision}."},
            {"stage": "audit", "detail": "Decision saved to SQLite."}
        ],
    }
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO moderation_logs(id, request_json, response_json, created_at) VALUES (?, ?, ?, ?)", (response["id"], json.dumps(inp.__dict__), json.dumps(response), datetime.now(timezone.utc).isoformat()))
        if review:
            conn.execute("INSERT INTO review_queue(case_id, response_json, created_at) VALUES (?, ?, ?)", (response["id"], json.dumps(response), datetime.now(timezone.utc).isoformat()))
    return response


def list_review_queue() -> List[Dict[str, Any]]:
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT case_id, response_json, status FROM review_queue WHERE status='pending' ORDER BY created_at ASC").fetchall()
    return [{"case_id": row["case_id"], "status": row["status"], "ai_decision": json.loads(row["response_json"])} for row in rows]


def save_review(case_id: str, decision: str, notes: str = "") -> Dict[str, Any]:
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT response_json FROM review_queue WHERE case_id=?", (case_id,)).fetchone()
        if not row:
            raise KeyError(case_id)
        conn.execute("UPDATE review_queue SET status='reviewed' WHERE case_id=?", (case_id,))
        conn.execute("INSERT INTO moderator_feedback(case_id, decision, notes, created_at) VALUES (?, ?, ?, ?)", (case_id, decision, notes, datetime.now(timezone.utc).isoformat()))
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
        res = moderate(ModerationInput(content=content, platform=platform, conversation_context="Movie quote discussion." if "villain" in content else ""))
        ok = res["primary_category"] == expected or (expected == "none" and res["routing"] == "allow")
        passed += int(ok)
        results.append({"content": content, "expected": expected, "actual": res["primary_category"], "routing": res["routing"], "passed": ok})
    return {"total": len(results), "passed": passed, "failed": len(results)-passed, "results": results}
