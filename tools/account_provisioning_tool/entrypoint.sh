#!/bin/bash
# Cyber Sentinels Account Provisioning Service Entrypoint

set -e

echo "=========================================="
echo "  Cyber Sentinels Account Provisioning"
echo "=========================================="

# Ensure data directory exists
mkdir -p /data /app/logs

# Initialize database if it doesn't exist
if [ ! -f "$PROVISION_DB_PATH" ]; then
    echo "Initializing database at $PROVISION_DB_PATH"
    python -c "from api import init_db; init_db()"
fi

echo "Configuration:"
echo "  Host: $PROVISION_HOST"
echo "  Port: $PROVISION_PORT"
echo "  Workers: $PROVISION_WORKERS"
echo "  Database: $PROVISION_DB_PATH"
echo "=========================================="

# Start gunicorn
exec gunicorn \
    --bind "${PROVISION_HOST}:${PROVISION_PORT}" \
    --workers "${PROVISION_WORKERS}" \
    --timeout "${PROVISION_TIMEOUT}" \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --enable-stdio-inheritance \
    "api:app"
