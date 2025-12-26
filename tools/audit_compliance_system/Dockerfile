# Cyber Sentinels Audit & Compliance Monitoring Tool
FROM python:3.12-slim

LABEL maintainer="Cyber Sentinels Team"
LABEL description="Audit Monitoring Tool - SQLite logging and compliance reporting"
LABEL version="1.0.0"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AUDIT_API_HOST=0.0.0.0 \
    AUDIT_API_PORT=5060 \
    AUDIT_API_WORKERS=2 \
    AUDIT_API_TIMEOUT=60 \
    AUDIT_DB_PATH=/data/audit.db \
    AUDIT_REPORT_PATH=/data/compliance_report.txt \
    AUDIT_ALERTS_FILE=/data/alerts.txt \
    AUDIT_LOG_FILE=/data/audit_logs.txt \
    AUDIT_MODE=api

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Create directory structure first
RUN mkdir -p /data /app/db /app/monitoring /app/reports

# Copy all Python modules with proper structure
COPY db/__init__.py /app/db/__init__.py
COPY db/audit_db.py /app/db/audit_db.py
COPY monitoring/__init__.py /app/monitoring/__init__.py
COPY monitoring/audit_tool.py /app/monitoring/audit_tool.py
COPY reports/__init__.py /app/reports/__init__.py
COPY reports/compliance_report.py /app/reports/compliance_report.py
COPY api_server.py /app/api_server.py
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

RUN useradd -m -u 1000 audit \
    && chown -R audit:audit /app /data
USER audit

EXPOSE 5060

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${AUDIT_API_PORT:-5060}/health || exit 1

CMD ["/app/entrypoint.sh"]
