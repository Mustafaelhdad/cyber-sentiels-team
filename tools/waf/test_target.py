#!/usr/bin/env python3
"""
Simple target server for testing WAF proxy mode.
This simulates a real website behind the WAF.

Run this on port 4000, then configure WAF to proxy to it.
"""

from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/")
def home():
    return jsonify({
        "message": "Target server OK",
        "path": request.path,
        "method": request.method
    })

@app.route("/api/users")
def users():
    return jsonify({
        "users": [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"},
        ]
    })

@app.route("/api/search")
def search():
    query = request.args.get("q", "")
    return jsonify({
        "query": query,
        "results": [f"Result for: {query}"]
    })

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    return jsonify({
        "message": "Login attempt received",
        "username": data.get("username", "anonymous")
    })

@app.route("/<path:any>")
def catch_all(any):
    return jsonify({
        "message": "Target server - catch all",
        "path": f"/{any}",
        "method": request.method,
        "args": dict(request.args)
    })

if __name__ == "__main__":
    print("=" * 50)
    print("Target Server for WAF Testing")
    print("=" * 50)
    print("Running on http://127.0.0.1:4000")
    print("")
    print("Configure your WAF map file with:")
    print('  {"testtoken": "http://127.0.0.1:4000"}')
    print("")
    print("Then test via:")
    print("  http://127.0.0.1:5000/waf/testtoken/")
    print("=" * 50)
    app.run(host="0.0.0.0", port=4000, debug=True)
