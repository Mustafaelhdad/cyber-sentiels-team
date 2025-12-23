#!/usr/bin/env bash
set -e

RASP_PORT="${RASP_PORT:-9000}"
RASP_HOST="${RASP_HOST:-0.0.0.0}"
RASP_WORKERS="${RASP_WORKERS:-2}"
RASP_TIMEOUT="${RASP_TIMEOUT:-60}"
RASP_DB_PATH="${RASP_DB_PATH:-/data/rasp_incidents.db}"
RASP_ENABLE_DEMO="${RASP_ENABLE_DEMO:-false}"

export RASP_DB_PATH

mkdir -p "$(dirname "${RASP_DB_PATH}")"
mkdir -p /data /app/logs

python - <<'PY'
from api import database
print(f"Initializing RASP database at {database.DB_PATH}")
database.init_db()
PY

if [ "${RASP_ENABLE_DEMO,,}" = "true" ] || [ "${RASP_ENABLE_DEMO}" = "1" ]; then
  export RASP_API_ENDPOINT="${RASP_API_ENDPOINT:-http://127.0.0.1:${RASP_PORT}/rasp/notify}"
  export EXAMPLE_APP_PORT="${EXAMPLE_APP_PORT:-5001}"
  echo "Starting demo target app on port ${EXAMPLE_APP_PORT}, reporting to ${RASP_API_ENDPOINT}"
  python -m example_app.app &
fi

echo "Starting RASP API on ${RASP_HOST}:${RASP_PORT}"
exec gunicorn --bind "${RASP_HOST}:${RASP_PORT}" --workers "${RASP_WORKERS}" --timeout "${RASP_TIMEOUT}" --access-logfile "-" --error-logfile "-" api.api:app
