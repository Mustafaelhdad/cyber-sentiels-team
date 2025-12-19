# example_app/app.py
"""
Example target application for the RASP monitor.

Provides:
- /echo (GET/POST) which echoes back parameters
- /health for quick liveness check
- /demo-trigger to send one synthetic incident to the configured API
- /send-samples to run a small battery of attack payloads (POST)

Usage:
    # run normally
    python -m example_app.app

Environment:
    RASP_API_ENDPOINT  - URL where the monitor should POST incidents (default: http://127.0.0.1:9000/rasp/notify)
    EXAMPLE_APP_PORT   - port to bind this example app (default: 5001)
"""
import logging
import os
import time
from typing import List
from flask import Flask, request, jsonify
from flask_cors import CORS
from agent.monitor import RASPMonitor
from api import database

API_ENDPOINT = os.environ.get("RASP_API_ENDPOINT", "http://127.0.0.1:9000/rasp/notify")
PORT = int(os.environ.get("EXAMPLE_APP_PORT", 5001))
HOST = os.environ.get("EXAMPLE_APP_HOST", "127.0.0.1")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("example_app")

app = Flask(__name__)
CORS(app)  

try:
    database.init_db()
    log.info("API database initialized (for demo).")
except Exception as e:
    log.warning("Could not initialize API database: %s", e)

monitor = RASPMonitor(
    send_to_api=True,
    api_endpoint=API_ENDPOINT,
    agent_name="student-rasp"
)
monitor.attach_to_flask(app)
log.info("RASP monitor attached to Flask app (will forward to %s).", API_ENDPOINT)

SAMPLE_PAYLOADS: List[str] = [
    "<script>alert(1)</script>",                     
    "1 OR 1=1 --",                                    
    "id=1; SLEEP(5)",                                 
    "ls; rm -rf /tmp/test",                           
    "../../etc/passwd",                               
    "http://127.0.0.1:8080/internal",                 
    "<?xml version='1.0'?><!DOCTYPE r [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]>",  
    "O:8:\"stdClass\":0:{}",                          
    "AAAAAAAA" * 100                                 
]


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "agent": monitor.agent_name}), 200


@app.route("/echo", methods=["GET", "POST"])
def echo():
    """
    Echo endpoint used to demonstrate how the monitor inspects input.
    Works with form, query-string and JSON bodies.
    """
    data = request.get_json(silent=True) or request.values.to_dict()
    return jsonify({"received": data})


@app.route("/demo-trigger", methods=["POST"])
def demo_trigger():
    """
    Create a synthetic incident and report it (useful for demo presentation).
    This function calls the monitor's internal reporter directly.
    """
    inc = {
        "id": f"demo-{monitor.agent_name}-{int(time.time())}",
        "agent": monitor.agent_name,
        "ts": int(time.time()),
        "path": "/demo-trigger",
        "source": "server",
        "param": "demo",
        "value_snippet": "<script>alert('demo')</script>",
        "finding_type": "xss",
        "occurrence": 1
    }
    try:
        if hasattr(monitor, "_report_incident"):
            monitor._report_incident(inc)
        else:
            log.info("Monitor has no _report_incident; incident would be: %s", inc)
        return jsonify({"status": "demo_sent", "incident": inc}), 201
    except Exception as e:
        log.exception("Failed to send demo incident: %s", e)
        return jsonify({"error": str(e)}), 500


@app.route("/send-samples", methods=["POST"])
def send_samples():
    """
    Trigger a sequence of requests to /echo with a list of attack payloads.
    Useful to rapidly populate the dashboard for demos.

    Optional JSON body:
      {"target": "/echo", "field": "payload", "limit": 10}
    """
    cfg = request.get_json(silent=True) or {}
    target = cfg.get("target", "/echo")
    field = cfg.get("field", "input")
    limit = int(cfg.get("limit", len(SAMPLE_PAYLOADS)))
    sent = []

    import requests
    base_url = f"http://{HOST}:{PORT}"
    for payload in SAMPLE_PAYLOADS[:limit]:
        try:
            url = base_url + target
            requests.post(url, data={field: payload}, timeout=2)
            sent.append({"target": target, "field": field, "payload": payload})
        except Exception as e:
            log.warning("Failed to send sample to %s: %s", url, e)

    return jsonify({"sent": len(sent), "details": sent}), 200


if __name__ == "__main__":
    log.info("Starting example app on http://%s:%s (forwarding incidents to %s)", HOST, PORT, API_ENDPOINT)
    app.run(host=HOST, port=PORT, debug=False)
