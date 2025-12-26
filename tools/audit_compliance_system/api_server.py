"""
Audit & Compliance Monitoring API
Connects the frontend to audit logging and reporting.
"""

import logging
import os
import sqlite3
import sys
import time
from datetime import datetime

from flask import Flask, jsonify, request, send_file

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, BASE_DIR)

from db.audit_db import DB_PATH, init_audit_db
from monitoring.audit_tool import (
    ALERTS_FILE,
    HIGH_RISK_THRESHOLD,
    generate_demo_events,
    log_event,
)
from reports.compliance_report import REPORT_PATH, build_report_data, generate_compliance_report


AUDIT_API_HOST = os.environ.get("AUDIT_API_HOST", "0.0.0.0")
AUDIT_API_PORT = int(os.environ.get("AUDIT_API_PORT", "5060"))
MAX_EVENTS = int(os.environ.get("AUDIT_API_MAX_EVENTS", "500"))


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("audit-compliance-api")

app = Flask(__name__)


def get_db_connection():
    init_audit_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def format_event(event_row):
    return {
        "timestamp": event_row[0],
        "user": event_row[1],
        "action": event_row[2],
        "risk": event_row[3],
    }


def read_lines(path, limit):
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        lines = [line.rstrip("\n") for line in f.readlines()]
    if limit:
        return lines[-limit:]
    return lines


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "audit-compliance",
        "timestamp": int(time.time()),
    })


@app.route("/api/audit/log", methods=["POST"])
def api_log_event():
    data = request.get_json(silent=True) or {}
    user = data.get("user", "").strip()
    action = data.get("action", "").strip()

    if not user or not action:
        return jsonify({"error": "user and action are required"}), 400

    record = log_event(user, action)
    logger.info("Logged audit event for user %s", user)

    return jsonify({
        "success": True,
        "event": record,
    }), 201


@app.route("/api/audit/demo", methods=["POST"])
def api_demo_events():
    count = generate_demo_events()
    return jsonify({
        "success": True,
        "events_logged": count,
    })


@app.route("/api/audit/events", methods=["GET"])
def api_list_events():
    user_filter = request.args.get("user", "").strip()
    action_filter = request.args.get("action", "").strip()
    min_risk = request.args.get("min_risk", type=int)
    limit = min(request.args.get("limit", 100, type=int), MAX_EVENTS)
    offset = max(request.args.get("offset", 0, type=int), 0)

    conn = get_db_connection()
    try:
        query = "SELECT timestamp, user, action, risk FROM audit_logs WHERE 1=1"
        params = []

        if user_filter:
            query += " AND user LIKE ?"
            params.append(f"%{user_filter}%")
        if action_filter:
            query += " AND action LIKE ?"
            params.append(f"%{action_filter}%")
        if min_risk is not None:
            query += " AND risk >= ?"
            params.append(min_risk)

        count_query = query.replace(
            "SELECT timestamp, user, action, risk",
            "SELECT COUNT(*)",
        )
        total = conn.execute(count_query, params).fetchone()[0]

        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = conn.execute(query, params).fetchall()
        events = [format_event(row) for row in rows]
    finally:
        conn.close()

    return jsonify({
        "events": events,
        "total": total,
        "limit": limit,
        "offset": offset,
    })


@app.route("/api/audit/stats", methods=["GET"])
def api_stats():
    conn = get_db_connection()
    try:
        total = conn.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]
        high_risk = conn.execute(
            "SELECT COUNT(*) FROM audit_logs WHERE risk >= ?",
            (HIGH_RISK_THRESHOLD,),
        ).fetchone()[0]
        latest = conn.execute("SELECT MAX(timestamp) FROM audit_logs").fetchone()[0]
    finally:
        conn.close()

    return jsonify({
        "service": "audit-compliance",
        "total_events": total,
        "high_risk_events": high_risk,
        "high_risk_threshold": HIGH_RISK_THRESHOLD,
        "latest_event_time": latest,
        "timestamp": int(time.time()),
    })


@app.route("/api/audit/report", methods=["GET"])
def api_report_summary():
    include_events = request.args.get("include_events", "false").lower() == "true"
    include_high_risk = request.args.get("include_high_risk", "false").lower() == "true"
    limit = min(request.args.get("limit", 100, type=int), MAX_EVENTS)

    report_data = build_report_data()
    response = {
        "generated_at": report_data["generated_at"],
        "total_events": report_data["total_events"],
        "high_risk_count": report_data["high_risk_count"],
        "high_risk_threshold": HIGH_RISK_THRESHOLD,
        "compliance_status": report_data["compliance_status"],
    }

    if include_high_risk:
        response["high_risk_events"] = [
            format_event(event)
            for event in report_data["high_risk_events"][-limit:]
        ]
    if include_events:
        response["events"] = [
            format_event(event)
            for event in report_data["events"][-limit:]
        ]

    return jsonify(response)


@app.route("/api/audit/report", methods=["POST"])
def api_generate_report():
    generate_compliance_report()
    report_data = build_report_data()

    return jsonify({
        "success": True,
        "report_path": REPORT_PATH,
        "generated_at": report_data["generated_at"],
        "total_events": report_data["total_events"],
        "high_risk_count": report_data["high_risk_count"],
        "compliance_status": report_data["compliance_status"],
    })


@app.route("/api/audit/report/file", methods=["GET"])
def api_report_file():
    refresh = request.args.get("refresh", "false").lower() == "true"
    if refresh or not os.path.exists(REPORT_PATH):
        generate_compliance_report()

    if not os.path.exists(REPORT_PATH):
        return jsonify({"error": "Report file not found"}), 404

    return send_file(
        REPORT_PATH,
        mimetype="text/plain",
        as_attachment=True,
        download_name=os.path.basename(REPORT_PATH),
    )


@app.route("/api/audit/alerts", methods=["GET"])
def api_alerts():
    limit = min(request.args.get("limit", 100, type=int), MAX_EVENTS)
    lines = read_lines(ALERTS_FILE, limit)
    return jsonify({
        "alerts": lines,
        "total": len(lines),
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(e):
    logger.error("Server error: %s", e)
    return jsonify({"error": "Internal server error"}), 500


init_audit_db()

if __name__ == "__main__":
    logger.info("Starting Audit Compliance API on %s:%s", AUDIT_API_HOST, AUDIT_API_PORT)
    app.run(
        host=AUDIT_API_HOST,
        port=AUDIT_API_PORT,
        debug=os.environ.get("AUDIT_API_DEBUG", "false").lower() == "true",
    )
