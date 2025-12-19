# api/api.py
from flask import Flask, request, jsonify, render_template
from datetime import datetime
import sqlite3
import os
from flask_cors import CORS

app = Flask(__name__, template_folder="gui")
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), "rasp_incidents.db")

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                agent TEXT,
                ts INTEGER,
                path TEXT,
                source TEXT,
                param TEXT,
                value_snippet TEXT,
                finding_type TEXT,
                occurrence INTEGER
            )
        """)
        conn.commit()

@app.route("/")
def index():
    return render_template("dashboard.html")

@app.route("/rasp/notify", methods=["POST"])
def rasp_notify():
    try:
        data = request.get_json(force=True)
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("""
                INSERT OR REPLACE INTO incidents
                (id, agent, ts, path, source, param, value_snippet, finding_type, occurrence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("id"),
                data.get("agent"),
                data.get("ts", int(datetime.now().timestamp())),
                data.get("path"),
                data.get("source"),
                data.get("param"),
                data.get("value_snippet"),
                data.get("finding_type"),
                data.get("occurrence", 1)
            ))
            conn.commit()
        return jsonify({"status": "received"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/rasp/incidents", methods=["GET"])
def get_incidents():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM incidents ORDER BY ts DESC")
            data = c.fetchall()

        keys = ["id","agent","ts","path","source","param","value_snippet","finding_type","occurrence"]
        incidents = []
        for row in data:
            record = dict(zip(keys, row))
            record["timestamp_readable"] = datetime.fromtimestamp(record["ts"]).strftime("%Y-%m-%d %H:%M:%S")
            incidents.append(record)
        return jsonify(incidents)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    init_db()
    app.run(port=9000, debug=True)
