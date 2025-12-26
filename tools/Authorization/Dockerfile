# Cyber Sentinels Authorization Service
# RBAC and ABAC-based access control
FROM python:3.12-slim

LABEL maintainer="Cyber Sentinels Team"
LABEL org.opencontainers.image.title="Cyber Sentinels Authorization Service"
LABEL org.opencontainers.image.description="Authorization Service - Role-Based and Attribute-Based Access Control"
LABEL org.opencontainers.image.vendor="cybersentinelsteam"
LABEL org.opencontainers.image.version="1.0.0"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AUTHZ_HOST=0.0.0.0 \
    AUTHZ_PORT=5001 \
    AUTHZ_WORKERS=2 \
    AUTHZ_TIMEOUT=60 \
    AUTHZ_USER_FILE=/data/users.txt \
    AUTHZ_LOG_FILE=/data/authorization.log \
    AUTHZ_DEFAULT_GROUP=general \
    AUTHZ_ADMIN_PIN=1234 \
    AUTHZ_DEBUG=false

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
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY api.py /app/api.py
COPY entrypoint.sh /app/entrypoint.sh

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Create necessary directories with proper permissions
RUN mkdir -p /data /app/logs \
    && chmod 755 /data /app/logs

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# Run entrypoint
CMD ["/app/entrypoint.sh"]

