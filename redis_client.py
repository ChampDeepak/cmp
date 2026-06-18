from __future__ import annotations

import os

try:
    import redis
except ModuleNotFoundError:  # Redis is optional; direct /moderate works without it.
    redis = None

REDIS_URL = os.getenv("REDIS_URL")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
QUEUE_NAME = os.getenv("QUEUE_NAME", "moderation_queue")

if redis is None:
    redis_client = None
elif REDIS_URL:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
else:
    redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
