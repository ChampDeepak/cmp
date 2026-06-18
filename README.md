# 🛡️ ModGuard — AI Content Moderation Pipeline

An end-to-end, asynchronous content moderation system. Platforms send user-generated
posts to a single API endpoint; the system queues them, analyzes each one with an LLM,
stores anything that violates policy, and **automatically emails the platform owner**
when harmful content is detected.

Built to be horizontally scalable: the API never blocks on AI analysis — it just
enqueues work, and a background worker processes the queue independently.

---

## ✨ What it does

- **Accepts moderation requests** over a simple JSON REST API.
- **Queues** every request on a Redis Stream so traffic spikes never overwhelm the analyzer.
- **Analyzes** each post with a large language model (Groq + Llama 3.3 70B), classifying it into one of:
  - `safe` · `self-harm` · `hate-speech` · `adult-content`
  - …with a **confidence score**, **reasoning**, and the exact **flagged keywords**.
- **Context-aware rules** — the same post is judged differently depending on the platform
  (e.g. a kids' app) and the audience age (e.g. under 18).
- **Stores flagged content** in a Postgres database for review and auditing.
- **Emails the platform owner** the moment a violation is found — with the category,
  confidence, flagged keywords, and reasoning.
- **Admin dashboard** (React) — live stats, category charts, full results table, and
  platform management.

---

## 🏗️ Architecture

```
                        ┌──────────────────────────────┐
   Browser ──HTTPS──▶   │  Frontend (React + Vite)      │
                        │  Dashboard · Submit · Results  │
                        └───────────────┬────────────────┘
                                        │ REST (JSON)
                                        ▼
                        ┌──────────────────────────────┐
                        │  API Gateway (FastAPI)         │
                        │  POST /moderate  → enqueue     │
                        └───────────────┬────────────────┘
                                        │ xadd
                                        ▼
                        ┌──────────────────────────────┐
                        │  Redis Stream (message queue)  │
                        └───────────────┬────────────────┘
                                        │ xread
                                        ▼
                        ┌──────────────────────────────┐
                        │  Worker (async background task)│
                        │  analyze → store → notify      │
                        └──┬─────────────┬─────────────┬─┘
                           │             │             │
                           ▼             ▼             ▼
                      Groq LLM     Postgres (DB)   Email (Resend)
                      (analysis)   (flagged posts)  (owner alert)
```

The **API and the worker run in a single process**: `main.py` exposes the FastAPI `app`,
and its startup lifespan launches the worker as a background async task. The two
communicate only through the Redis queue, so they can also be split into separate
services later with zero code changes.

---

## 🔁 How a request flows

1. A platform calls **`POST /moderate`** with the post text, its `platform_id`, and the
   target `age`.
2. The gateway assigns a `request_id`, pushes the job onto the Redis Stream, and instantly
   returns `{ "status": "queued", "request_id": ... }`. No waiting on the AI.
3. The worker reads the next job, sends it to the LLM, and gets back a structured verdict.
4. **If the post is flagged** (category is not `safe` and confidence > 50%):
   - the result is saved to the database, and
   - an **alert email is sent to the platform's registered address**.
5. Safe posts are acknowledged and skipped — only real violations are stored and reported.

---

## 📬 Email notifications

When the analyzer flags a post, ModGuard immediately notifies the affected platform's
owner by email so they can act fast. Each alert includes everything needed to make a
decision:

- the detected **category** (e.g. `hate-speech`),
- the **confidence score**,
- the specific **flagged keywords**,
- the model's **reasoning**, and
- the **original post text**.

Emails are delivered through the **[Resend](https://resend.com) HTTP API** (over HTTPS),
which is reliable in cloud environments and keeps delivery fast and trackable. The
recipient is whatever email a platform registered with — so every platform gets alerts
for its own content automatically.

---

## 🧰 Tech stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Frontend    | React, Vite, Tailwind CSS, Recharts         |
| API Gateway | FastAPI (Python), Uvicorn                   |
| Queue       | Redis Streams                               |
| Worker      | Async Python background task                |
| AI          | Groq + Llama 3.3 70B (`llama-3.3-70b-versatile`) |
| Database    | PostgreSQL (Supabase)                       |
| Email       | Resend (HTTP API)                           |

---

## 📂 Project structure

```
cmp/
├── main.py            # FastAPI app + lifespan that starts the worker
├── worker.py          # Consumes the queue, runs AI, stores + emails results
├── aiAnalizer.py      # Groq LLM client + moderation prompt/schema
├── database.py        # Postgres connection pool + queries
├── redis_client.py    # Redis connection (stream queue)
├── email_client.py    # Resend email sender
├── init_db.py         # Creates tables if they don't exist
├── requirements.txt   # Python dependencies
├── render.yaml        # Render deployment blueprint
├── Dockerfile         # Container image (API + worker)
├── docker-compose.yml # Local one-command stack (bundles Redis)
├── DEPLOYMENT.md      # Full deployment guide
└── frontend/          # React admin dashboard
```

---

## 🌐 API endpoints

| Method | Path                        | Description                                        |
|--------|-----------------------------|----------------------------------------------------|
| GET    | `/`                         | Health check (Redis + DB status)                   |
| POST   | `/register-platform`        | Register a platform (`name`, `email`)              |
| GET    | `/platforms`                | List registered platforms                          |
| POST   | `/moderate`                 | Submit content for moderation (`text`, `platform_id`, `age`) |
| GET    | `/moderation-results`       | List flagged results (optional `?platform_id=`)    |
| GET    | `/queue/stats`              | Current queue size                                 |
| GET    | `/admin/dashboard-stats`    | Aggregate stats for the dashboard                  |

---

## ⚙️ Setup

### 1. Configure environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable          | What it is                                                      |
|-------------------|----------------------------------------------------------------|
| `SUPABASE_URL`    | Postgres connection string (Supabase → Settings → Database)    |
| `GROQ_API_KEY`    | Groq API key (https://console.groq.com/keys)                   |
| `RESEND_API_KEY`  | Resend API key (https://resend.com/api-keys)                   |
| `RESEND_FROM`     | The "From" address for alert emails                            |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection (or set a single `REDIS_URL`) |
| `QUEUE_NAME`      | Redis stream name (default `moderation_queue`)                 |

### 2. Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## ▶️ Running locally

Open two terminals.

**Terminal 1 — backend** (API + worker + DB init, all in one process):

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

**Terminal 2 — frontend:**

```bash
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173**. The frontend reads its API base URL from
`frontend/.env` (`VITE_API_URL`), which defaults to `http://localhost:8001`.

**Health check:**

```bash
curl http://localhost:8001/
# {"status":"running", "dependencies":{"redis":"ok","database":"ok"}}
```

### Run the whole stack with Docker (bundles Redis)

```bash
docker compose up --build
```

---

## 🧪 Quick test

```bash
API="http://localhost:8001"

# 1. Register a platform
curl -X POST "$API/register-platform" -H "Content-Type: application/json" \
  -d '{"name":"my-app","email":"owner@example.com"}'

# 2. Submit a post (use the platform_id returned above)
curl -X POST "$API/moderate" -H "Content-Type: application/json" \
  -d '{"text":"You are worthless and should be bullied off here","platform_id":1,"age":"below 18"}'

# 3. See the result a few seconds later
curl "$API/moderation-results"
```

If the post is flagged, it appears in the results **and** an alert email is sent to the
platform's registered address.

---

## 🚀 Deployment

The project is deployment-ready for **Render** (backend Docker service + frontend static
site) and **Railway**, with all dependencies on free/managed tiers. See
**[DEPLOYMENT.md](DEPLOYMENT.md)** for the full step-by-step guide.

---

## 📜 Moderation policy (summary)

Posts are evaluated top-to-bottom and assigned the **first** matching category:

1. **self-harm** — self-injury/suicide content (any audience); or vaping/smoking/underage
   drinking when the audience is under 18 or the platform is for kids.
2. **hate-speech** — harassment, targeted bullying, hate speech, aggressive insults.
3. **adult-content** — explicit material (any audience); or age-inappropriate romance/dating
   themes for under-18 or kids' platforms.
4. **safe** — none of the above for the given context.
