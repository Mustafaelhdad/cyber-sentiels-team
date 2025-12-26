import argparse
import os
import sys
import sqlite3
from datetime import datetime


# ==============================
# Fix project path
# ==============================
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

from db.audit_db import DB_PATH, init_audit_db

# ==============================
# Paths
# ==============================
ALERTS_FILE = os.environ.get(
    "AUDIT_ALERTS_FILE",
    os.path.join(BASE_DIR, "monitoring", "alerts.txt"),
)
AUDIT_LOG_FILE = os.environ.get(
    "AUDIT_LOG_FILE",
    os.path.join(BASE_DIR, "monitoring", "audit_logs.txt"),
)

HIGH_RISK_THRESHOLD = int(os.environ.get("AUDIT_HIGH_RISK_THRESHOLD", "7"))

# ==============================
# Risk Scoring
# ==============================


def calculate_risk(action):
    action = action.lower()

    if "failed login" in action or "multiple failed" in action:
        return 8
    elif "unauthorized" in action:
        return 9
    elif "admin" in action or "privilege" in action:
        return 7
    elif "delete" in action:
        return 6
    else:
        return 3


# ==============================
# Log Event
# ==============================


def log_event(user, action):
    risk = calculate_risk(action)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO audit_logs (timestamp, user, action, risk)
        VALUES (?, ?, ?, ?)
    """, (timestamp, user, action, risk))

    conn.commit()
    conn.close()

    if risk >= HIGH_RISK_THRESHOLD:
        write_alert(user, action, risk, timestamp)

        _ensure_parent_dir(AUDIT_LOG_FILE)
        with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(
                f"{timestamp} | User: {user} | Action: {action} | Risk: {risk}\n"
            )

    return {
        "timestamp": timestamp,
        "user": user,
        "action": action,
        "risk": risk,
    }


# ==============================
# Write Alerts
# ==============================


def write_alert(user, action, risk, timestamp):
    _ensure_parent_dir(ALERTS_FILE)
    with open(ALERTS_FILE, "a", encoding="utf-8") as f:
        f.write(
            f"[ALERT] {timestamp} | User: {user} | Action: {action} | Risk: {risk}\n"
        )


# ==============================
# Demo Events
# ==============================


def generate_demo_events():
    events = [
        ("ahmed", "Failed login attempt"),
        ("sara", "Unauthorized access to system"),
        ("admin", "Admin privilege escalation"),
        ("mohamed", "Delete user account"),
        ("ali", "Normal login"),
        ("ahmed", "Multiple failed login attempts"),
    ]

    for user, action in events:
        log_event(user, action)

    return len(events)


def _ensure_parent_dir(path):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def build_arg_parser():
    parser = argparse.ArgumentParser(description="Audit Monitoring Tool")
    parser.add_argument("--user", help="Username to log")
    parser.add_argument("--action", help="Action to log")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Log demo events instead of a single event",
    )
    return parser


# ==============================
# Main
# ==============================


def main():
    init_audit_db()

    parser = build_arg_parser()
    args = parser.parse_args()

    if args.demo:
        generate_demo_events()
        print("Demo events logged successfully.")
        return

    if not args.user or not args.action:
        parser.error("Both --user and --action are required unless --demo is set.")

    log_event(args.user, args.action)
    print("Event logged successfully.")


if __name__ == "__main__":
    main()
