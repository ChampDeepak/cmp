import os
import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
QUEUE_NAME = os.getenv("QUEUE_NAME", "moderation_queue")

# Managed Redis providers (e.g. Upstash) hand out a single connection URL
# (rediss://... for TLS). If REDIS_URL is set we use it directly; from_url
# handles the rediss:// scheme and enables TLS automatically. Otherwise we
# fall back to the discrete host/port/password vars for local development.
REDIS_URL = os.getenv("REDIS_URL")

if REDIS_URL:
    redis_client = redis.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_timeout=10.0,
        socket_connect_timeout=10.0,
        retry_on_timeout=True,
        socket_keepalive=True,
    )
else:
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        db=0,
        decode_responses=True,
        socket_timeout=10.0,
        socket_connect_timeout=10.0,
        retry_on_timeout=True,
        socket_keepalive=True,
    )
