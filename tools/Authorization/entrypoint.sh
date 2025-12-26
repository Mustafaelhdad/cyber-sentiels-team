#!/bin/bash
# Cyber Sentinels Authorization Service Entrypoint

set -e

echo "=========================================="
echo "  Cyber Sentinels Authorization Service"
echo "=========================================="

# Ensure data directory exists
mkdir -p /data /app/logs

# Initialize users file if it doesn't exist
if [ ! -f "$AUTHZ_USER_FILE" ]; then
    echo "Initializing users file at $AUTHZ_USER_FILE"
    cat > "$AUTHZ_USER_FILE" << EOF
# Cyber Sentinels Authorization Service - User Database
# Format: email,password_hash,role,group
EOF
fi

# Initialize log file if it doesn't exist
if [ ! -f "$AUTHZ_LOG_FILE" ]; then
    echo "Initializing log file at $AUTHZ_LOG_FILE"
    touch "$AUTHZ_LOG_FILE"
fi

echo "Configuration:"
echo "  Host: $AUTHZ_HOST"
echo "  Port: $AUTHZ_PORT"
echo "  Workers: $AUTHZ_WORKERS"
echo "  Timeout: $AUTHZ_TIMEOUT"
echo "  User File: $AUTHZ_USER_FILE"
echo "  Log File: $AUTHZ_LOG_FILE"
echo "  Default Group: $AUTHZ_DEFAULT_GROUP"
echo "=========================================="

# Start gunicorn
exec gunicorn \
    --bind "${AUTHZ_HOST}:${AUTHZ_PORT}" \
    --workers "${AUTHZ_WORKERS}" \
    --timeout "${AUTHZ_TIMEOUT}" \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --enable-stdio-inheritance \
    "api:app"

