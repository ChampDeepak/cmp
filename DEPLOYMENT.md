# Deployment Guide — AI Content Moderation Pipeline

Fastest path to a live deployment with minimal server management.
**Total time to go live: ~20–30 minutes.** Every service used has a free tier.

---

## Architecture

```
                          ┌─────────────────────────┐
 Browser ──HTTPS──▶  Frontend (Vercel static)
                          │  Vite build, VITE_API_URL│
                          └────────────┬────────────┘
                                       │ HTTPS (CORS: *)
                                       ▼
                          ┌─────────────────────────┐
                          │  Backend single service  │   (Railway / Render)
                          │  uvicorn main:app         │
                          │                           │
                          │  ┌──────────┐  ┌────────┐ │
                          │  │ API      │  │ Worker │ │
                          │  │ FastAPI  │  │ async  │ │
                          │  │ (main.py)│  │ task   │ │
                          │  └────┬─────┘  └───┬────┘ │
                          └───────┼────────────┼──────┘
                                  │ xadd       │ xread
                                  ▼            ▼
                          ┌────────────────────────────┐
                          │  Redis Stream (Upstash TLS) │
                          └────────────────────────────┘
                                       │ worker processes job
                          ┌────────────┼───────────┬──────────────┐
                          ▼            ▼            ▼              ▼
                      Groq LLM   Supabase PG    SMTP (Gmail)
                      (analysis) (results)      (notify email)
```

The API and the worker run in the **same service**, in one process: `main.py` exposes
the FastAPI `app` and its lifespan starts the worker as a background async task
(launched with `uvicorn main:app`). This keeps deployment to a single container. The
two talk only through Redis.

---

## Step 1 — Provision managed dependencies (~10 min)

You need four credentials before deploying. Collect them into a scratch note.

### Supabase (Postgres) — `SUPABASE_URL`
Already in use. Just grab the connection string:
1. Supabase dashboard → your project → **Settings → Database**.
2. Under **Connection string**, select **URI**.
3. Copy it and replace `[YOUR-PASSWORD]` with your DB password.
   - Looks like: `postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres`
   - The app connects with `ssl="require"` already — no extra config needed.

### Upstash (Redis) — `REDIS_URL`
1. Go to https://console.upstash.com → **Create Database** (Redis).
2. Pick a region close to your backend region. Free tier is fine.
3. On the database page, copy the **`rediss://...` URL** (the TLS one).
   - It looks like: `rediss://default:TOKEN@us1-xxx.upstash.io:6379`
   - Our `redis_client.py` detects `REDIS_URL` and enables TLS automatically.

### Groq — `GROQ_API_KEY`
1. https://console.groq.com/keys → **Create API Key**.
2. Copy it (starts with `gsk_`).

### Gmail App Password — `SMTP_PASSWORD`
1. Enable 2-Step Verification on your Google account.
2. https://myaccount.google.com/apppasswords → create an app password.
3. Copy the 16-character password (no spaces). Use it as `SMTP_PASSWORD`.
   - `SMTP_USER` and `SENDER_EMAIL` are your Gmail address.

---

## Step 2 — Deploy the backend

### ✅ Recommended: Railway (~5 min)

Railway auto-detects the `Dockerfile` and `railway.json` in this repo.

1. https://railway.app → **New Project → Deploy from GitHub repo** → pick this repo.
2. Railway detects the Dockerfile and starts a build. It injects `PORT` automatically
   (the start command `uvicorn main:app --host 0.0.0.0 --port $PORT` reads it).
3. **Add Redis** — either:
   - **Easiest:** use the Upstash `REDIS_URL` you already copied (set it as an env var, below), **or**
   - In Railway: **New → Database → Add Redis**, then reference its connection URL.
     If you use Railway's internal Redis (non-TLS), set `REDIS_URL=redis://...` (single `s` only for TLS).
4. Open the service → **Variables** tab → add the env vars from the
   [table below](#environment-variables). At minimum: `SUPABASE_URL`, `GROQ_API_KEY`,
   `REDIS_URL`, `SMTP_*`, `SENDER_EMAIL`. (`PORT` is auto-injected — do not set it.)
5. Railway redeploys on save. Under **Settings → Networking**, click
   **Generate Domain** to get a public HTTPS URL.
6. Copy that URL (e.g. `https://your-app.up.railway.app`) — it's your backend URL.

### Alternative: Render (Blueprint)

This repo includes `render.yaml`.

1. https://render.com → **New → Blueprint** → connect this repo.
2. Render reads `render.yaml` and creates a Docker web service on the free plan.
3. Fill in the `sync: false` env vars when prompted (`SUPABASE_URL`, `GROQ_API_KEY`,
   `REDIS_URL`, `SMTP_USER`, `SMTP_PASSWORD`, `SENDER_EMAIL`).
4. Deploy. Render injects `PORT` and gives you an `onrender.com` HTTPS URL.
   Health check path is `/`.
   - Note: the free Render plan sleeps when idle — the worker also pauses while asleep.
     For an always-on worker, use a paid instance or Railway.

---

## Step 3 — Deploy the frontend (Vercel, ~3 min)

CORS is already open (`*`) on the backend, so no extra backend change is needed.

```bash
cd frontend
npm install
npx vercel            # first run links/creates the project
```

In the Vercel dashboard (or during CLI prompts) set the environment variable:

| Var            | Value                                   |
|----------------|-----------------------------------------|
| `VITE_API_URL` | your backend URL from Step 2 (no trailing slash), e.g. `https://your-app.up.railway.app` |

Then deploy production:

```bash
npx vercel --prod
```

Vercel auto-detects Vite and runs the static build. Done.

---

## Environment variables

| Variable         | Where to get it                                            | Example |
|------------------|------------------------------------------------------------|---------|
| `SUPABASE_URL`   | Supabase → Settings → Database → Connection string (URI)   | `postgresql://postgres:pw@db.xxxx.supabase.co:5432/postgres` |
| `GROQ_API_KEY`   | https://console.groq.com/keys                              | `gsk_xxxxxxxx` |
| `REDIS_URL`      | Upstash database page (the `rediss://` TLS URL) **(preferred)** | `rediss://default:TOKEN@us1-xxx.upstash.io:6379` |
| `REDIS_HOST`     | Local dev fallback (used only if `REDIS_URL` is unset)     | `localhost` |
| `REDIS_PORT`     | Local dev fallback                                         | `6379` |
| `REDIS_PASSWORD` | Local dev fallback (empty if none)                         | _(empty)_ |
| `QUEUE_NAME`     | Logical Redis stream name (default works)                  | `moderation_queue` |
| `SMTP_SERVER`    | Email provider SMTP host                                   | `smtp.gmail.com` |
| `SMTP_PORT`      | SMTP port (TLS)                                            | `587` |
| `SMTP_USER`      | Your email address                                         | `you@gmail.com` |
| `SMTP_PASSWORD`  | Gmail App Password (16 chars)                              | `abcd efgh ijkl mnop` → `abcdefghijklmnop` |
| `SENDER_EMAIL`   | "From" address (usually same as `SMTP_USER`)               | `you@gmail.com` |
| `PORT`           | **Auto-injected by Railway/Render — do not set manually.** Local default 8000. | `8000` |
| `VITE_API_URL`   | **Frontend only.** The backend's public URL.               | `https://your-app.up.railway.app` |

> Set **either** `REDIS_URL` (managed/cloud) **or** the `REDIS_HOST`/`PORT`/`PASSWORD`
> trio (local). If `REDIS_URL` is present it wins.

---

## Local Docker quickstart

Run the whole stack locally with one command. You only need Supabase, Groq and SMTP
creds in `.env` — Redis runs in a local container.

```bash
cp .env.example .env      # then fill in SUPABASE_URL, GROQ_API_KEY, SMTP_*, SENDER_EMAIL
docker compose up --build
```

The compose file overrides `REDIS_HOST=redis` so the app talks to the bundled Redis.
API comes up at http://localhost:8000.

---

## Post-deploy smoke test

Replace `$API` with your backend URL (`http://localhost:8000` locally, or your Railway/Render URL).

```bash
export API="https://your-app.up.railway.app"

# 1. Health check
curl "$API/"

# 2. Register a platform — returns {"platform_id": N}. Note the id.
curl -X POST "$API/register-platform" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-platform","email":"you@example.com"}'

# 3. Submit content for moderation (enqueues a job). Use the platform_id from step 2.
curl -X POST "$API/moderate" \
  -H "Content-Type: application/json" \
  -d '{"text":"This is a test message to moderate.","platform_id":1,"age":"adult"}'

# 4. Check results (worker processes the job, then writes here). Filter by platform_id.
curl "$API/moderation-results?platform_id=1"

# Also useful:
curl "$API/queue/stats"
curl "$API/admin/dashboard-stats"
```

> Request bodies match the Pydantic models in `api_gateway.py`:
> `/register-platform` takes `{name, email}`; `/moderate` takes `{text, platform_id, age}`.
> If `/moderation-results` is empty right after POSTing,
> wait a few seconds for the worker to consume the Redis stream and call Groq.

---

## Troubleshooting

- **Redis connection / TLS** — Upstash requires TLS. Use the `rediss://` URL (two `s`)
  in `REDIS_URL`. A `redis://` URL against Upstash will hang or refuse. `from_url`
  handles the TLS handshake automatically when the scheme is `rediss://`.
- **Supabase SSL** — the app already connects with `ssl="require"`. If you see SSL
  errors, confirm you're using the **direct** connection string (port 5432) and that
  the password is URL-safe (escape special chars, or reset to an alphanumeric one).
- **App not reachable / "no open ports"** — the platform sets `PORT`; uvicorn binds
  `0.0.0.0:$PORT`. Do **not** hardcode or override `PORT` on Railway/Render.
- **CORS errors in the browser** — CORS is already open (`*`) in `api_gateway.py`.
  If you still see errors, verify `VITE_API_URL` has no trailing slash and uses `https://`.
- **Worker not processing on Render free plan** — free instances sleep when idle, which
  pauses the worker. Use Railway or a paid Render instance for an always-on worker.
- **Email not sending** — Gmail needs an **App Password** (not your login password) and
  2-Step Verification enabled. Strip spaces from the 16-char password.
```
