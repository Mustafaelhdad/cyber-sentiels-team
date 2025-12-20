# Dockerfile for Cyber Sentinels SAST Scanner
# ============================================
# Provides a containerized SAST scanning service that can be invoked
# via CLI or HTTP API for integration with the web application.

FROM python:3.12-slim

LABEL maintainer="Cyber Sentinels Team"
LABEL description="Static Application Security Testing (SAST) Scanner"
LABEL version="1.0.0"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV SAST_RULES_FILE=/app/config/sast_rules.yaml
ENV SAST_OUTPUT_DIR=/app/output

# Create app directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir pyyaml requests gunicorn flask

# Copy application code
COPY sast_core/ ./sast_core/
COPY report_generator/ ./report_generator/
COPY config/ ./config/
COPY main.py .
COPY api_server.py .

# Create output directory
RUN mkdir -p /app/output /app/scans

# Create non-root user for security
RUN useradd -m -u 1000 scanner && \
    chown -R scanner:scanner /app
USER scanner

# Expose API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Default command - run API server
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "300", "api_server:app"]

# Alternative: Run CLI scan directly
# docker run -v /path/to/source:/scan sast-scanner python main.py sast -d /scan -o /app/output/report.json

