import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "users.db"


def init_db(db_path=DB_PATH):
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()

    c.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            email TEXT,
            role TEXT,
            status TEXT
        )
        """
    )

    c.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            username TEXT,
            details TEXT,
            created_at TEXT
        )
        """
    )

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
