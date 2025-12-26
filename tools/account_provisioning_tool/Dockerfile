# Cyber Sentinels Account Provisioning Service
# Automated account provisioning and IAM management
FROM python:3.12-slim

LABEL maintainer="Cyber Sentinels Team"
LABEL description="Account Provisioning Service - User provisioning, role management, and audit logging"
LABEL version="1.0.0"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROVISION_HOST=0.0.0.0 \
    PROVISION_PORT=5002 \
    PROVISION_WORKERS=2 \
    PROVISION_TIMEOUT=60 \
    PROVISION_DB_PATH=/data/users.db \
    PROVISION_ADMIN_KEY=change-this-in-production \
    PROVISION_DEBUG=false

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
EXPOSE 5002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5002/health || exit 1

# Run entrypoint
CMD ["/app/entrypoint.sh"]
