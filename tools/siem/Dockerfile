# Cyber Sentinels SIEM Tool
# Security Information and Event Management with real-time log analysis
FROM python:3.12-slim

LABEL maintainer="Cyber Sentinels Team"
LABEL description="Simple SIEM Tool - Log analysis, alerting, and real-time monitoring"
LABEL version="1.0.0"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SIEM_HOST=0.0.0.0 \
    SIEM_PORT=5000 \
    SIEM_WORKERS=2 \
    SIEM_TIMEOUT=120 \
    SIEM_SECRET_KEY=change-this-in-production \
    SIEM_TIP_ENABLED=true \
    SIEM_TIP_MODEL_DIR=/app/model \
    SIEM_REALTIME_POLL_INTERVAL=0.5

# Create app directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

# Copy application code
COPY siem_tool.py /app/siem_tool.py
COPY rules.json /app/rules.json
COPY index.html /app/index.html

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/uploads /app/reports /data \
    && chmod 755 /app/logs /app/uploads /app/reports /data

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/stats || exit 1

# Run entrypoint
CMD ["/app/entrypoint.sh"]

