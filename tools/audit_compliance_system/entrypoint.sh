#!/bin/sh
set -e

if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# Ensure data directory exists and is writable
mkdir -p /data

# Initialize the database before starting the API
echo "Initializing audit database..."
python -c "from db.audit_db import init_audit_db; init_audit_db()"

MODE="${AUDIT_MODE:-api}"

case "$MODE" in
    api)
        : "${AUDIT_API_HOST:=0.0.0.0}"
        : "${AUDIT_API_PORT:=5060}"
        : "${AUDIT_API_WORKERS:=2}"
        : "${AUDIT_API_TIMEOUT:=60}"
        echo "Starting Audit Compliance API on ${AUDIT_API_HOST}:${AUDIT_API_PORT}"
        exec gunicorn \
            --bind "${AUDIT_API_HOST}:${AUDIT_API_PORT}" \
            --workers "${AUDIT_API_WORKERS}" \
            --timeout "${AUDIT_API_TIMEOUT}" \
            --access-logfile - \
            --error-logfile - \
            --capture-output \
            --enable-stdio-inheritance \
            "api_server:app"
        ;;
    log)
        if [ -z "$AUDIT_USER" ] || [ -z "$AUDIT_ACTION" ]; then
            echo "AUDIT_USER and AUDIT_ACTION are required when AUDIT_MODE=log" >&2
            exit 1
        fi
        exec python /app/monitoring/audit_tool.py --user "$AUDIT_USER" --action "$AUDIT_ACTION"
        ;;
    demo)
        exec python /app/monitoring/audit_tool.py --demo
        ;;
    report)
        exec python /app/reports/compliance_report.py
        ;;
    *)
        echo "Unknown AUDIT_MODE: $MODE" >&2
        exit 1
        ;;
esac
