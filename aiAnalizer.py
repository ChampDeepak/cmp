"""Backward-compatible analyzer entrypoint.

The original project exposed `GroqModerator.evaluate_text`. This wrapper now uses the
complete moderation pipeline while preserving that interface.
"""
from __future__ import annotations

import json
from typing import Any, Dict

from moderation_pipeline import ModerationInput, moderate


def build_moderation_prompt(post_text: str, platform: str, age: str) -> str:
    return f"""Analyze content for trust and safety moderation.
Content: {post_text}
Platform: {platform}
Age/context: {age}
Return category scores, primary category, offending segment, reasoning, and recommended action as JSON."""


class GroqModerator:
    def __init__(self, model_id: str = "llama-3.3-70b-versatile"):
        self.model_id = model_id

    def evaluate_text(self, text: str, platform: str = "social_media", age: str = "unknown") -> Dict[str, Any]:
        return moderate(ModerationInput(content=text, platform=platform, conversation_context=f"age={age}"))


if __name__ == "__main__":
    moderator = GroqModerator()
    test_cases = [
        ("fuck off man", "social_media", "above 18"),
        ("Buy followers now! Click this link!", "social_media", "unknown"),
        ("I want to die and kill myself.", "social_media", "above 18"),
        ("The villain in the movie said, 'I will kill you.'", "social_media", "movie quote"),
    ]
    for text, platform, age in test_cases:
        print(json.dumps(moderator.evaluate_text(text, platform, age), indent=2))
