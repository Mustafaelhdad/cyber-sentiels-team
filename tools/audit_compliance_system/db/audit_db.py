import os
import sqlite3


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "db", "audit.db")
DB_PATH = os.environ.get("AUDIT_DB_PATH", DEFAULT_DB_PATH)
TABLE_NAME = "audit_logs"


def _table_exists(cursor, table_name):
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )
    return cursor.fetchone() is not None


def _get_columns(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]


def _ensure_risk_column(cursor):
    columns = _get_columns(cursor, TABLE_NAME)
    if "risk" not in columns and "risk_score" in columns:
        cursor.execute(f"ALTER TABLE {TABLE_NAME} ADD COLUMN risk INTEGER")
        cursor.execute(
            f"UPDATE {TABLE_NAME} SET risk = risk_score WHERE risk IS NULL"
        )


def _migrate_from_audit_events(cursor):
    if not _table_exists(cursor, "audit_events"):
        return

    cursor.execute(f"SELECT COUNT(1) FROM {TABLE_NAME}")
    existing = cursor.fetchone()[0]
    if existing:
        return

    event_columns = _get_columns(cursor, "audit_events")
    risk_column = None
    if "risk" in event_columns:
        risk_column = "risk"
    elif "risk_score" in event_columns:
        risk_column = "risk_score"

    if not risk_column:
        return

    cursor.execute(
        f"INSERT INTO {TABLE_NAME} (timestamp, user, action, risk) "
        f"SELECT timestamp, user, action, {risk_column} FROM audit_events"
    )


def init_audit_db(db_path=DB_PATH):
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute(f"""
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            user TEXT,
            action TEXT,
            risk INTEGER
        )
    """)

    _ensure_risk_column(c)
    _migrate_from_audit_events(c)

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_audit_db()
