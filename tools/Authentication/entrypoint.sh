#!/bin/bash
# Cyber Sentinels Authentication Service Entrypoint

set -e

echo "=========================================="
echo "  Cyber Sentinels Authentication Service"
echo "=========================================="

# Ensure data directory exists
mkdir -p /data /app/logs

# Initialize users file if it doesn't exist
if [ ! -f "$AUTH_USER_FILE" ]; then
    echo "Initializing users file at $AUTH_USER_FILE"
    touch "$AUTH_USER_FILE"
fi

echo "Configuration:"
echo "  Host: $AUTH_HOST"
echo "  Port: $AUTH_PORT"
echo "  Workers: $AUTH_WORKERS"
echo "  JWT TTL: $AUTH_JWT_TTL seconds"
echo "  User File: $AUTH_USER_FILE"
echo "=========================================="

# Start gunicorn
exec gunicorn \
    --bind "${AUTH_HOST}:${AUTH_PORT}" \
    --workers "${AUTH_WORKERS}" \
    --timeout "${AUTH_TIMEOUT}" \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --enable-stdio-inheritance \
    "api:app"

