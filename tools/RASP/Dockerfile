# Cyber Sentinels RASP Service
# Provides the RASP incident API + optional demo target app.

FROM python:3.12-slim

LABEL maintainer="Cyber Sentinels Team"
LABEL description="Runtime Application Self-Protection (RASP) API and demo app"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    RASP_HOST=0.0.0.0 \
    RASP_PORT=9000 \
    RASP_DB_PATH=/data/rasp_incidents.db \
    RASP_WORKERS=2 \
    RASP_TIMEOUT=60 \
    RASP_ENABLE_DEMO=false

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY agent/ /app/agent/
COPY api/ /app/api/
COPY example_app/ /app/example_app/
COPY entrypoint.sh /app/entrypoint.sh

RUN mkdir -p /data /app/logs && chmod +x /app/entrypoint.sh

EXPOSE 9000
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9000/health || exit 1

CMD ["/app/entrypoint.sh"]
