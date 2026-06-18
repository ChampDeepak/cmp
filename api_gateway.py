from __future__ import annotations

import json
import os
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from moderation_pipeline import (
    ModerationInput,
    get_policy,
    list_review_queue,
    load_policies,
    moderate,
    run_evaluation,
    save_review,
)
from redis_client import QUEUE_NAME, redis_client
from premium_ui import PREMIUM_UI

app = FastAPI(
    title="AI Content Moderation Pipeline",
    description="Groq-powered moderation with policy routing, explainability, human review, and evaluation.",
    version="2.0",
)

class ModerationRequest(BaseModel):
    content: str | None = None
    text: str | None = None
    platform: str = "social_media"
    age: str = "unknown"
    conversation_context: str = ""
    user_history: str = ""

class ReviewDecision(BaseModel):
    moderator_decision: str = Field(..., pattern="^(allow|warn|remove|escalate|auto_remove|urgent_escalation)$")
    moderator_notes: str = ""

@app.get("/")
def health_check() -> Dict[str, Any]:
    return {
        "status": "running",
        "service": "ai-content-moderation-pipeline",
        "classifier_provider": os.getenv("CLASSIFIER_PROVIDER", "auto"),
        "features": ["multi-category classification", "context-aware analysis", "policy routing", "human review", "evaluation", "audit logs"],
    }

@app.post("/moderate")
def moderate_content(request: ModerationRequest) -> Dict[str, Any]:
    content = request.content or request.text
    if not content:
        raise HTTPException(status_code=422, detail="content or text is required")
    return moderate(ModerationInput(content=content, platform=request.platform, conversation_context=request.conversation_context, user_history=request.user_history))

@app.post("/queue")
def queue_content(request: ModerationRequest) -> Dict[str, Any]:
    if redis_client is None:
        raise HTTPException(status_code=503, detail="Redis is not configured")
    content = request.content or request.text
    if not content:
        raise HTTPException(status_code=422, detail="content or text is required")
    event = request.model_dump()
    event["content"] = content
    redis_client.lpush(QUEUE_NAME, json.dumps(event))
    return {"status": "queued", "queue_name": QUEUE_NAME, "queue_size": redis_client.llen(QUEUE_NAME)}

@app.get("/review-queue")
def review_queue():
    return list_review_queue()

@app.post("/review/{case_id}")
def review_case(case_id: str, decision: ReviewDecision):
    try:
        return save_review(case_id, decision.moderator_decision, decision.moderator_notes)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="case not found") from exc

@app.get("/policies")
def policies():
    return load_policies()

@app.get("/policies/{platform}")
def policy(platform: str):
    return get_policy(platform)

@app.post("/evaluate")
def evaluate():
    return run_evaluation()

@app.get("/ui", response_class=HTMLResponse)
def ui():
    return PREMIUM_UI
