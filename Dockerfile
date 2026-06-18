# Slim Python 3.12 image for the AI Content Moderation pipeline.
# Runs the API gateway + worker together in one process: main.py exposes the
# FastAPI `app` and starts the worker as a background task via its lifespan.
FROM python:3.12-slim

# Keep Python output unbuffered so logs stream to the platform in real time.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the application code.
COPY . .

# Documents the default port. Platforms (Railway/Render) inject PORT at runtime.
EXPOSE 8000

# Launch the ASGI app with uvicorn, binding 0.0.0.0 and the injected PORT
# (defaults to 8000 locally). Shell form is used so ${PORT} is expanded.
# main.py's lifespan initializes the DB and starts the worker on startup.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
