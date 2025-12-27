#!/usr/bin/env bash
set -e

# Configuration with defaults
SOAR_PORT="${SOAR_PORT:-5000}"
SOAR_HOST="${SOAR_HOST:-0.0.0.0}"
SOAR_WORKERS="${SOAR_WORKERS:-2}"
SOAR_TIMEOUT="${SOAR_TIMEOUT:-120}"
SOAR_SECRET_KEY="${SOAR_SECRET_KEY:-change-this-in-production}"

# Export environment variables for the application
export SOAR_PORT
export SOAR_HOST
export SOAR_SECRET_KEY
export SOAR_DATA_DIR="${SOAR_DATA_DIR:-/data}"
export SOAR_LOG_DIR="${SOAR_LOG_DIR:-/app/logs}"
export SOAR_REPORTS_DIR="${SOAR_REPORTS_DIR:-/app/reports}"
export SIEM_API_URL="${SIEM_API_URL:-http://siem:5000}"

# Create necessary directories
mkdir -p /app/logs /app/reports /data

# Log startup information
echo "========================================"
echo "Cyber Sentinels SOAR Platform"
echo "========================================"
echo "Host: ${SOAR_HOST}"
echo "Port: ${SOAR_PORT}"
echo "Workers: ${SOAR_WORKERS}"
echo "Timeout: ${SOAR_TIMEOUT}s"
echo "Data Dir: ${SOAR_DATA_DIR}"
echo "SIEM URL: ${SIEM_API_URL}"
echo "========================================"

# Start SOAR server with gunicorn and gevent for WebSocket support
echo "Starting SOAR server on ${SOAR_HOST}:${SOAR_PORT}"
exec gunicorn \
    --bind "${SOAR_HOST}:${SOAR_PORT}" \
    --workers "${SOAR_WORKERS}" \
    --timeout "${SOAR_TIMEOUT}" \
    --worker-class gevent \
    --access-logfile "-" \
    --error-logfile "-" \
    --log-level info \
    "soar_api:app"

