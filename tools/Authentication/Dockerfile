# Cyber Sentinels Authentication Service
# JWT-based authentication with OTP verification
FROM python:3.12-slim

LABEL maintainer="Cyber Sentinels Team"
LABEL description="Authentication Service - User management, JWT tokens, and OTP verification"
LABEL version="1.0.0"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AUTH_HOST=0.0.0.0 \
    AUTH_PORT=5000 \
    AUTH_WORKERS=2 \
    AUTH_TIMEOUT=60 \
    AUTH_JWT_SECRET=change-this-in-production \
    AUTH_JWT_TTL=3600 \
    AUTH_STATIC_OTP=5555 \
    AUTH_USER_FILE=/data/users.txt \
    AUTH_DEBUG=false

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
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run entrypoint
CMD ["/app/entrypoint.sh"]

