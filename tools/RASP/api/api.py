# api/api.py
from flask import Flask, request, jsonify, render_template
import sqlite3
import os
from flask_cors import CORS
from . import database

app = Flask(__name__, template_folder="gui")
CORS(app)

DB_PATH = database.DB_PATH
HOST = os.environ.get("RASP_HOST", "0.0.0.0")
PORT = int(os.environ.get("RASP_PORT", 9000))

database.init_db()

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
        database.insert_incident(data)
        return jsonify({"status": "received"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/rasp/incidents", methods=["GET"])
def get_incidents():
    try:
        limit = int(request.args.get("limit", 100))
        incidents = database.query_recent(limit=limit)
        return jsonify(incidents)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    try:
        database.init_db()
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM incidents")
            count_row = c.fetchone()
            count = count_row[0] if count_row else 0
        return jsonify({"status": "ok", "db_path": DB_PATH, "incidents": count}), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host=HOST, port=PORT, debug=False)
