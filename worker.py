import asyncio
from redis_client import redis_client, QUEUE_NAME
from database import get_db_pool, get_platform_mapping, get_platform_by_id, get_platform_email_by_id, save_request_result
from aiAnalizer import GroqModerator
from email_client import send_email


async def moderation_worker():

    db_pool = await get_db_pool()


    platform_map = await get_platform_mapping(db_pool)
    print(f"Loaded Platform Map: {platform_map}")

    ai = GroqModerator()

    saved_bookmark = await redis_client.get("moderation_worker_bookmark")
    last_id = saved_bookmark if saved_bookmark else "0-0"
    print(f"Worker started. Resuming from Redis ID: {last_id}")

    try:
        while True:

            streams = await redis_client.xread({QUEUE_NAME: last_id}, count=1, block=5000)

            if not streams:
                continue

            stream_name, messages = streams[0]
            message_id, request_data = messages[0]

            # Process each message defensively: a single bad message (bad data,
            # AI/DB hiccup, etc.) must never crash the whole worker. We always
            # advance the bookmark afterwards so a "poison" message isn't retried
            # forever.
            try:
                request_id = request_data.get("request_id")
                text_to_check = request_data.get("text")
                age = request_data.get("age")

                print(f"\n--- Processing Job: {request_id} ---")

                platform_id = int(request_data.get("platform_id"))
                platform_name = platform_map.get(platform_id)

                if not platform_name:
                    print(f"Platform ID '{platform_id}' not in local map. Fetching from DB...")
                    platform_name = await get_platform_by_id(db_pool, platform_id)

                    if platform_name:
                        print(f"Found platform '{platform_name}' in DB. Updating local map.")
                        platform_map[platform_id] = platform_name
                    else:
                        print(f"⚠️ Warning: Unknown platform id '{platform_id}'. Skipping save.")
                        platform_name = None

                if platform_name:
                    ai_result = await asyncio.to_thread(
                        ai.evaluate_text,
                        text=text_to_check,
                        platform=platform_name,
                        age=age
                    )

                    post_category = ai_result.get("post_category")
                    reasoning = ai_result.get("reasoning")
                    confidence_score = ai_result.get("confidence_score")
                    flagged_keywords = ai_result.get("flagged_keywords")

                    # An "anomaly" is content the AI flagged as NOT safe with >50% confidence.
                    # Per the pipeline design, only anomalies are saved to the DB and emailed.
                    is_anomaly = (
                        post_category not in ("safe", "error")
                        and confidence_score is not None
                        and confidence_score > 0.5
                    )

                    if is_anomaly:
                        await save_request_result(db_pool, request_id, platform_id, reasoning, post_category, confidence_score, flagged_keywords)

                        platform_email = await get_platform_email_by_id(db_pool, platform_id)
                        if platform_email:
                            subject = f"⚠️ Content Moderation Alert: '{post_category}' detected ({round(confidence_score * 100)}% confidence)"
                            body = f"""
                            A post on your platform '{platform_name}' was flagged by the AI moderation pipeline.

                            Request ID: {request_id}
                            Category: {post_category}
                            Confidence: {round(confidence_score * 100)}%
                            Flagged keywords: {', '.join(flagged_keywords) if flagged_keywords else 'N/A'}
                            Reasoning: {reasoning}

                            Original text:
                            {text_to_check}

                            Please review this case.
                            """
                            send_email(platform_email, subject, body)
                        else:
                            print(f"⚠️ Could not find email for platform ID '{platform_id}'. Skipping email notification.")
                        print(f"🚨 ANOMALY [{post_category} @ {round(confidence_score * 100)}%] saved + emailed for request '{request_id}'")
                    else:
                        print(f"✅ SAFE (category={post_category}, confidence={confidence_score}) — request '{request_id}' not flagged.")

            except Exception as e:
                print(f"⚠️ Error processing message {message_id}: {e}")

            # Always advance the bookmark, even on error, so we never reprocess
            # (and never get stuck on) the same message.
            last_id = message_id
            await redis_client.set("moderation_worker_bookmark", last_id)

    except asyncio.CancelledError:
        print("Worker shutting down.")
    # NOTE: we intentionally do NOT close db_pool here. The worker now runs as a
    # background task inside the API process and shares the app's connection pool;
    # the pool is owned and closed by the FastAPI lifespan handler in main.py.
