#!/usr/bin/env bash
set -e

# Configuration with defaults
SIEM_PORT="${SIEM_PORT:-5000}"
SIEM_HOST="${SIEM_HOST:-0.0.0.0}"
SIEM_WORKERS="${SIEM_WORKERS:-2}"
SIEM_TIMEOUT="${SIEM_TIMEOUT:-120}"
SIEM_SECRET_KEY="${SIEM_SECRET_KEY:-change-this-in-production}"

# Export environment variables for the application
export SIEM_PORT
export SIEM_HOST
export SIEM_SECRET_KEY

# Create necessary directories
mkdir -p /app/logs /app/uploads /app/reports /data

# Log startup information
echo "========================================"
echo "Cyber Sentinels SIEM Tool"
echo "========================================"
echo "Host: ${SIEM_HOST}"
echo "Port: ${SIEM_PORT}"
echo "Workers: ${SIEM_WORKERS}"
echo "Timeout: ${SIEM_TIMEOUT}s"
echo "TIP Model Enabled: ${SIEM_TIP_ENABLED:-true}"
echo "TIP Model Dir: ${SIEM_TIP_MODEL_DIR:-/app/model}"
echo "========================================"

# Start SIEM server with gunicorn and gevent for WebSocket support
echo "Starting SIEM server on ${SIEM_HOST}:${SIEM_PORT}"
exec gunicorn \
    --bind "${SIEM_HOST}:${SIEM_PORT}" \
    --workers "${SIEM_WORKERS}" \
    --timeout "${SIEM_TIMEOUT}" \
    --worker-class gevent \
    --access-logfile "-" \
    --error-logfile "-" \
    --log-level info \
    "siem_tool:app"
