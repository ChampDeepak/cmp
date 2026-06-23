import uuid
import asyncio
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from redis_client import redis_client, QUEUE_NAME
from database import get_db_pool, close_db_pool, register_platform
from init_db import initialize_database
from worker import moderation_worker


# ==========================
# Lifespan (Startup & Shutdown)
# ==========================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    print("--- Initializing Database ---")
    await initialize_database()
    print("--- Database is Ready ---")

    # Warm the shared connection pool once at startup so requests reuse it.
    print("--- Warming database connection pool ---")
    await get_db_pool()
    print("--- Connection pool ready ---")

    # Start the worker as a background async task
    print("👷 Starting Moderation Worker as background task...")
    worker_task = asyncio.create_task(moderation_worker())

    yield  # App is running and serving requests

    # --- Shutdown ---
    print("🛑 Shutting down worker...")
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        print("--- Worker stopped. ---")

    # Close the shared connection pool.
    print("--- Closing database connection pool ---")
    await close_db_pool()


app = FastAPI(
    title="AI Content Moderation API Gateway",
    description="Receives moderation requests and pushes them to Redis queue",
    version="1.0",
    lifespan=lifespan
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================
# Request Schemas
# ==========================

class ModerationRequest(BaseModel):
    text: str = Field(..., min_length=1)
    platform_id: int
    age: str

class PlatformRegistrationRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr # Pydantic will validate the email format


# ==========================
# Health Check
# ==========================

@app.get("/")
async def health_check():
    health_status = {
        "status": "running",
        "service": "content-moderation-api-gateway",
        "dependencies": {
            "redis": "unknown",
            "database": "unknown"
        }
    }
    
    # Check Redis
    try:
        await redis_client.ping()
        health_status["dependencies"]["redis"] = "ok"
    except Exception as e:
        health_status["dependencies"]["redis"] = f"error: {str(e)}"
        health_status["status"] = "degraded"

    # Check Database (uses the shared pool; do not close it)
    try:
        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            await conn.execute("SELECT 1")
        health_status["dependencies"]["database"] = "ok"
    except Exception as e:
        health_status["dependencies"]["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"

    return health_status


# ==========================
# Platform Registration
# ==========================

@app.post("/register-platform")
async def register_platform_endpoint(request: PlatformRegistrationRequest):
    try:
        db_pool = await get_db_pool()
        new_id = await register_platform(db_pool, request.name, request.email)
        
        if new_id:
            return {
                "status": "success",
                "message": f"Platform '{request.name}' registered successfully.",
                "platform_id": new_id
            }
        else:
            # This happens if the platform name already exists
            raise HTTPException(
                status_code=409, # 409 Conflict
                detail=f"Platform '{request.name}' already exists."
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions so FastAPI can handle them correctly
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to register platform: {str(e)}"
        )


# ==========================
# Queue Moderation Request
# ==========================

@app.post("/moderate")
async def moderate_content(request: ModerationRequest):

    try:

        request_id = str(uuid.uuid4())

        event = {
            "request_id": request_id,
            "text": request.text,
            "platform_id": request.platform_id,
            "age": request.age,
            "timestamp": datetime.utcnow().isoformat()
        }

        await redis_client.xadd(QUEUE_NAME,event)

        queue_size = await redis_client.xlen(QUEUE_NAME)

        return {
            "status": "queued",
            "request_id": request_id,
            "queue_name": QUEUE_NAME,
            "queue_size": queue_size
        }

    except HTTPException:
        raise
    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to queue request: {str(e)}"
        )


# ==========================
# Queue Statistics
# ==========================

@app.get("/queue/stats")
async def queue_stats():

    try:

        return {
            "queue_name": QUEUE_NAME,
            "queue_size": await redis_client.xlen(QUEUE_NAME)
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==========================
# List Platforms
# ==========================

@app.get("/platforms")
async def list_platforms():
    try:
        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT id, name, email FROM platforms ORDER BY id")
            return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================
# Moderation Results
# ==========================

@app.get("/moderation-results")
async def get_moderation_results(platform_id: int = Query(None)):
    try:
        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            if platform_id:
                rows = await conn.fetch(
                    """SELECT mr.request_id, mr.platform_id, p.name as platform_name,
                              mr.reason, mr.post_category, mr.confidence_score,
                              mr.flagged_keywords, mr.completed_at
                       FROM moderation_results mr
                       JOIN platforms p ON mr.platform_id = p.id
                       WHERE mr.platform_id = $1
                       ORDER BY mr.completed_at DESC""",
                    platform_id
                )
            else:
                rows = await conn.fetch(
                    """SELECT mr.request_id, mr.platform_id, p.name as platform_name,
                              mr.reason, mr.post_category, mr.confidence_score,
                              mr.flagged_keywords, mr.completed_at
                       FROM moderation_results mr
                       JOIN platforms p ON mr.platform_id = p.id
                       ORDER BY mr.completed_at DESC"""
                )
            results = []
            for row in rows:
                r = dict(row)
                r["request_id"] = str(r["request_id"])
                if r["completed_at"]:
                    ts = r["completed_at"]
                    # Stored values are UTC; mark them as UTC so the browser
                    # converts to the viewer's local time instead of treating
                    # the UTC numbers as local.
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    r["completed_at"] = ts.isoformat()
                results.append(r)
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================
# Admin Dashboard Stats
# ==========================

@app.get("/admin/dashboard-stats")
async def admin_dashboard_stats():
    try:
        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            # Collapse the three scalar aggregates into a single round-trip.
            totals = await conn.fetchrow(
                """SELECT
                       (SELECT COUNT(*) FROM platforms)                    AS total_platforms,
                       (SELECT COUNT(*) FROM moderation_results)           AS total_results,
                       (SELECT AVG(confidence_score) FROM moderation_results) AS avg_confidence"""
            )
            total_platforms = totals["total_platforms"]
            total_results = totals["total_results"]
            avg_confidence = totals["avg_confidence"]
            category_rows = await conn.fetch(
                """SELECT post_category, COUNT(*) as count
                   FROM moderation_results
                   GROUP BY post_category
                   ORDER BY count DESC"""
            )
            categories = {row["post_category"]: row["count"] for row in category_rows}

            queue_size = 0
            try:
                queue_size = await redis_client.xlen(QUEUE_NAME)
            except Exception:
                pass

            return {
                "total_platforms": total_platforms,
                "total_moderation_results": total_results,
                "avg_confidence_score": round(float(avg_confidence), 3) if avg_confidence else 0,
                "categories": categories,
                "queue_size": queue_size
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))