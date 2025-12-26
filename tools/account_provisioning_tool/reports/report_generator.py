import sqlite3
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from db.database import DB_PATH, init_db


def count_actions(conn, action):
    row = conn.execute(
        "SELECT COUNT(*) FROM audit_log WHERE action=?",
        (action,)
    ).fetchone()
    return row[0] if row else 0


def generate_report():
    init_db()
    with sqlite3.connect(str(DB_PATH)) as conn:
        created = count_actions(conn, "create")
        modified = count_actions(conn, "modify")
        disabled = count_actions(conn, "disable")

    lines = [
        "SECURITY REPORT",
        "============================",
        f"Generated on: {datetime.utcnow().isoformat()}",
        "",
        "Account Activities Summary:",
        f"- Accounts Created: {created}",
        f"- Accounts Modified: {modified}",
        f"- Accounts Disabled: {disabled}",
        "",
        "End of Report",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_report())
