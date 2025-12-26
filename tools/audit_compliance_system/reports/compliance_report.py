import os
import sys
import sqlite3
from datetime import datetime


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

from db.audit_db import DB_PATH, init_audit_db


REPORT_PATH = os.environ.get(
    "AUDIT_REPORT_PATH",
    os.path.join(BASE_DIR, "reports", "compliance_report.txt"),
)
HIGH_RISK_THRESHOLD = int(os.environ.get("AUDIT_HIGH_RISK_THRESHOLD", "7"))


def generate_compliance_report(db_path=DB_PATH, report_path=REPORT_PATH):
    report_data = build_report_data(db_path)
    events = report_data["events"]
    high_risk_events = report_data["high_risk_events"]
    compliance_status = report_data["compliance_status"]
    generated_at = report_data["generated_at"]

    report_dir = os.path.dirname(report_path)
    if report_dir:
        os.makedirs(report_dir, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("COMPLIANCE & AUDIT REPORT\n")
        f.write(f"Generated at: {generated_at}\n")
        f.write("=" * 50 + "\n")
        f.write(f"Total Events: {report_data['total_events']}\n")
        f.write(
            f"High Risk Events (>= {HIGH_RISK_THRESHOLD}): "
            f"{report_data['high_risk_count']}\n"
        )
        f.write(f"Compliance Status: {compliance_status}\n")
        f.write("=" * 50 + "\n")

        if high_risk_events:
            f.write("HIGH RISK EVENTS\n")
            f.write("-" * 50 + "\n")
            for event in high_risk_events:
                f.write(f"Time: {event[0]}\n")
                f.write(f"User: {event[1]}\n")
                f.write(f"Action: {event[2]}\n")
                f.write(f"Risk Level: {event[3]}\n")
                f.write("-" * 50 + "\n")
            f.write("=" * 50 + "\n")

        if events:
            f.write("ALL EVENTS\n")
            f.write("-" * 50 + "\n")
            for event in events:
                f.write(f"Time: {event[0]}\n")
                f.write(f"User: {event[1]}\n")
                f.write(f"Action: {event[2]}\n")
                f.write(f"Risk Level: {event[3]}\n")
                f.write("-" * 50 + "\n")


def fetch_audit_events(db_path=DB_PATH):
    init_audit_db(db_path)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT timestamp, user, action, risk FROM audit_logs ORDER BY timestamp")
    events = c.fetchall()
    conn.close()
    return events


def build_report_data(db_path=DB_PATH, high_risk_threshold=HIGH_RISK_THRESHOLD):
    events = fetch_audit_events(db_path)
    high_risk_events = [
        event for event in events
        if event[3] is not None and event[3] >= high_risk_threshold
    ]
    return {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_events": len(events),
        "high_risk_count": len(high_risk_events),
        "high_risk_events": high_risk_events,
        "compliance_status": "COMPLIANT" if not high_risk_events else "NON-COMPLIANT",
        "events": events,
    }


if __name__ == "__main__":
    generate_compliance_report()
