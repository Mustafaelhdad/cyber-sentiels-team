# Cyber Sentinels SOAR Tool
# Security Orchestration, Automation and Response Platform
FROM python:3.12-slim

LABEL maintainer="Cyber Sentinels Team"
LABEL description="SOAR - Security Orchestration, Automation and Response Platform"
LABEL version="1.0.0"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SOAR_HOST=0.0.0.0 \
    SOAR_PORT=5000 \
    SOAR_WORKERS=2 \
    SOAR_TIMEOUT=120 \
    SOAR_SECRET_KEY=change-this-in-production \
    SOAR_DATA_DIR=/data \
    SOAR_LOG_DIR=/app/logs \
    SOAR_REPORTS_DIR=/app/reports \
    SIEM_API_URL=http://siem:5000

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
COPY soar_api.py /app/soar_api.py
COPY alert.json /app/alert.json

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/reports /data \
    && chmod 755 /app/logs /app/reports /data

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Run entrypoint
CMD ["/app/entrypoint.sh"]

