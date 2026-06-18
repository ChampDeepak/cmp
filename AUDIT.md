# Detailed Audit — Assignment 10 Gaps

Repository reviewed: `https://github.com/ChampDeepak/cmp`

## Current problems found

1. `requirements.txt` is empty even though the app imports `groq`, `fastapi`, `pydantic`, and `redis`.
2. `aiAnalizer.py` hardcodes `api_key = ""`, so Groq mode cannot run.
3. The prompt classifies only `self-harm`, `hate-speech`, `adult-content`, and `safe`; it misses required categories: harassment, spam, misinformation, graphic violence.
4. Classifier returns one category only; assignment requires confidence scores for all categories.
5. API only queues to Redis; it does not return moderation decisions.
6. Redis host/port are hardcoded and Redis is required even for simple testing.
7. No confidence-based routing: allow vs human review vs auto-action.
8. No platform policy configuration for children/social/adult platforms.
9. No human review queue interface.
10. No audit persistence.
11. No evaluation endpoint or labelled tests.
12. No UI for demo/testing.

## PR scope

This feature branch fixes the missing assignment requirements while keeping changes focused:

- Add configurable policies.
- Fix Groq environment usage and structured prompt.
- Use Groq with the structured moderation prompt for runtime classification; mock the Groq boundary in tests.
- Add direct `/moderate` decision endpoint.
- Keep Redis queue optional instead of required.
- Add review queue and policy endpoints.
- Add `/evaluate` endpoint.
- Add polished built-in UI with improved colour palette.
- Add minimal tests and docs.
