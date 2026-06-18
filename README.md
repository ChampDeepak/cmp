# TrustShield AI — Content Moderation Pipeline

Focused PR upgrade for Assignment 10. The app now works as a real moderation assistant instead of only queuing messages.

## What was fixed

- Groq API key now comes from `GROQ_API_KEY`, never hardcoded.
- Added structured moderation prompt in `config/moderation_prompt.md`.
- Added all required harm categories.
- Added confidence scores for every category.
- Added policy config for:
  - `children_app`
  - `social_media`
  - `adult_discussion_platform`
- Added routing: `allow`, `human_review`, `auto_action`, `urgent_escalation`.
- Added SQLite audit logs and human review queue.
- Added `/evaluate` endpoint and tests.
- Added polished built-in UI at `/ui` with a cleaner cyan/violet 3D-style palette.
- Redis queue is now optional.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
CLASSIFIER_PROVIDER=groq GROQ_API_KEY=your_key uvicorn api_gateway:app --reload
```

The moderation classifier requires Groq because production classification is driven by the structured system prompt in `config/moderation_prompt.md`.

Open:

- UI: http://127.0.0.1:8000/ui
- API docs: http://127.0.0.1:8000/docs

## APIs

- `POST /moderate`
- `POST /queue`
- `GET /review-queue`
- `POST /review/{case_id}`
- `GET /policies`
- `GET /policies/{platform}`
- `POST /evaluate`

## Example request

```json
{
  "content": "You are useless and should disappear.",
  "platform": "children_app",
  "conversation_context": "Two students are arguing in a classroom thread.",
  "user_history": "User has 2 previous harassment warnings."
}
```

## Test

```bash
python3 -m unittest discover -s tests -v
```


## Provider behavior

`CLASSIFIER_PROVIDER=groq` is the default and recommended mode. The classifier sends content, platform policy, conversation context, user history, and required categories to Groq with the structured moderation system prompt. There is no production keyword fallback; tests mock the Groq boundary so routing and audit behavior can still be verified without network access.
