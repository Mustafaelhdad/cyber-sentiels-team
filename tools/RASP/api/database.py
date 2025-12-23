# api/database.py
"""
Enhanced SQLite storage for RASP incidents.
"""
import sqlite3
import json
from typing import List, Dict, Any
from datetime import datetime
import os

DB_PATH = os.environ.get(
    "RASP_DB_PATH",
    os.path.join(os.path.dirname(__file__), "rasp_incidents.db"),
)

def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        cur = conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            agent TEXT,
            ts INTEGER,
            datetime TEXT,
            path TEXT,
            source TEXT,
            param TEXT,
            value_snippet TEXT,
            finding_type TEXT,
            occurrence INTEGER,
            raw JSON
        )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ts ON incidents(ts DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_finding ON incidents(finding_type)")
        conn.commit()


def insert_incident(inc: Dict[str, Any]) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("""
        INSERT OR REPLACE INTO incidents
        (id, agent, ts, datetime, path, source, param, value_snippet, finding_type, occurrence, raw)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            inc.get("id"),
            inc.get("agent"),
            inc.get("ts"),
            datetime.fromtimestamp(inc.get("ts", 0)).strftime("%Y-%m-%d %H:%M:%S"),
            inc.get("path"),
            inc.get("source"),
            inc.get("param"),
            inc.get("value_snippet"),
            inc.get("finding_type"),
            inc.get("occurrence", 1),
            json.dumps(inc, ensure_ascii=False)
        ))
        conn.commit()


def query_recent(limit: int = 100) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("""
        SELECT id, agent, ts, datetime, path, source, param, value_snippet, finding_type, occurrence, raw
        FROM incidents
        ORDER BY ts DESC
        LIMIT ?
        """, (limit,))
        rows = cur.fetchall()

    results = []
    for r in rows:
        try:
            raw = json.loads(r[10]) if r[10] else {}
        except json.JSONDecodeError:
            raw = {}

        results.append({
            "id": r[0],
            "agent": r[1],
            "ts": r[2],
            "datetime": r[3],
            "path": r[4],
            "source": r[5],
            "param": r[6],
            "value_snippet": r[7],
            "finding_type": r[8],
            "occurrence": r[9],
            "raw": raw
        })
    return results


def query_by_type(finding_type: str) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("""
        SELECT id, agent, datetime, path, source, finding_type, raw
        FROM incidents
        WHERE finding_type = ?
        ORDER BY ts DESC
        """, (finding_type,))
        rows = cur.fetchall()
    return [{"id": r[0], "agent": r[1], "datetime": r[2], "path": r[3], "source": r[4], "finding_type": r[5]} for r in rows]
