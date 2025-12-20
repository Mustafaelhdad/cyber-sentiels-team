# Flask WAF Proxy
# Lightweight reverse proxy with attack detection
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install dependencies
# Using --no-cache-dir to keep image small
RUN pip install --no-cache-dir flask requests gunicorn

# Copy application
COPY app.py /app/app.py
COPY requirements.txt /app/requirements.txt

# Create directories (will be mounted as volumes)
# Set permissions that allow other containers (www-data) to write
RUN mkdir -p /shared /app/logs \
    && chmod 777 /shared \
    && chmod 777 /app/logs

# Environment variables (can be overridden)
ENV PYTHONUNBUFFERED=1 \
    WAF_MAP_FILE=/shared/waf-map.json \
    WAF_HOST=0.0.0.0 \
    WAF_PORT=5000 \
    WAF_DEBUG=false \
    WAF_PROXY_TIMEOUT=30

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# Run with gunicorn for production (4 workers, timeout 60s)
# For development, override with: python app.py
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
