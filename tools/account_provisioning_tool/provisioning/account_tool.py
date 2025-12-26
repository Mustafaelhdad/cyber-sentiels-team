import sqlite3
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from db.database import DB_PATH, init_db


def log_action(conn, action, username, details=""):
    conn.execute(
        """
        INSERT INTO audit_log (action, username, details, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (action, username, details, datetime.utcnow().isoformat())
    )


def create_user(username, email, role, status="active"):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute(
            "INSERT INTO users (username, email, role, status) VALUES (?, ?, ?, ?)",
            (username, email, role, status)
        )
        log_action(
            conn,
            "create",
            username,
            f"email={email};role={role};status={status}"
        )


def modify_user(username, new_role):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute(
            "UPDATE users SET role=? WHERE username=?",
            (new_role, username)
        )
        log_action(conn, "modify", username, f"role={new_role}")


def disable_user(username):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute(
            "UPDATE users SET status='disabled' WHERE username=?",
            (username,)
        )
        log_action(conn, "disable", username, "status=disabled")


def run_demo():
    init_db()
    create_user("ahmed", "ahmed@mail.com", "IT")
    create_user("sara", "sara@mail.com", "HR")
    create_user("omar", "omar@mail.com", "Finance")

    modify_user("sara", "Manager")
    disable_user("omar")


if __name__ == "__main__":
    run_demo()
