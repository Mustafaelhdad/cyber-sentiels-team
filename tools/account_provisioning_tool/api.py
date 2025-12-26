"""
Cyber Sentinels Account Provisioning Service API
Provides automated account provisioning, user management, and audit logging for IAM.
"""

import sqlite3
import os
import time
import logging
from datetime import datetime
from pathlib import Path
from functools import wraps

from flask import Flask, request, jsonify

# ================= Configuration ==================
PROVISION_HOST = os.environ.get("PROVISION_HOST", "0.0.0.0")
PROVISION_PORT = int(os.environ.get("PROVISION_PORT", "5002"))
DB_PATH = os.environ.get("PROVISION_DB_PATH", "/data/users.db")
ADMIN_API_KEY = os.environ.get("PROVISION_ADMIN_KEY", "provision-admin-key")
# ==================================================

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("account-provisioning-service")

app = Flask(__name__)

# ================= Available Roles ==================
AVAILABLE_ROLES = ["IT", "HR", "Finance", "Manager", "Admin", "Security", "Operations", "Guest"]
AVAILABLE_STATUSES = ["active", "disabled", "pending", "suspended"]


# ================= Database Functions ==================

def ensure_db_dir():
    """Ensure database directory exists"""
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)


def init_db():
    """Initialize the database with required tables"""
    ensure_db_dir()
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()

    c.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TEXT,
            updated_at TEXT
        )
        """
    )

    c.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            username TEXT NOT NULL,
            details TEXT,
            performed_by TEXT,
            created_at TEXT
        )
        """
    )

    conn.commit()
    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")


def get_db_connection():
    """Get a database connection"""
    ensure_db_dir()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def log_action(conn, action, username, details="", performed_by="system"):
    """Log an action to the audit log"""
    conn.execute(
        """
        INSERT INTO audit_log (action, username, details, performed_by, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (action, username, details, performed_by, datetime.utcnow().isoformat())
    )


# ================= Helper Functions ==================

def require_api_key(f):
    """Decorator to require API key for admin operations"""
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get("X-API-Key", "")
        if api_key != ADMIN_API_KEY:
            return jsonify({"error": "Invalid or missing API key"}), 401
        return f(*args, **kwargs)
    return decorated


def validate_email(email):
    """Basic email validation"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_username(username):
    """Validate username format"""
    import re
    pattern = r'^[a-zA-Z0-9_-]{3,50}$'
    return bool(re.match(pattern, username))


# ================= API Routes ==================

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "account-provisioning",
        "timestamp": int(time.time())
    })


@app.route("/api/provision/users", methods=["GET"])
def list_users():
    """List all provisioned users"""
    status_filter = request.args.get("status", "").strip().lower()
    role_filter = request.args.get("role", "").strip()
    search = request.args.get("search", "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    
    conn = get_db_connection()
    try:
        query = "SELECT * FROM users WHERE 1=1"
        params = []
        
        if status_filter and status_filter in AVAILABLE_STATUSES:
            query += " AND status = ?"
            params.append(status_filter)
        
        if role_filter and role_filter in AVAILABLE_ROLES:
            query += " AND role = ?"
            params.append(role_filter)
        
        if search:
            query += " AND (username LIKE ? OR email LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        
        # Get total count
        count_query = query.replace("SELECT *", "SELECT COUNT(*)")
        total = conn.execute(count_query, params).fetchone()[0]
        
        # Add pagination
        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])
        
        rows = conn.execute(query, params).fetchall()
        
        users = []
        for row in rows:
            users.append({
                "id": row["id"],
                "username": row["username"],
                "email": row["email"],
                "role": row["role"],
                "status": row["status"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            })
        
        return jsonify({
            "users": users,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page
        })
    finally:
        conn.close()


@app.route("/api/provision/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    """Get a specific user by ID"""
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        
        if not row:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "role": row["role"],
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        })
    finally:
        conn.close()


@app.route("/api/provision/users", methods=["POST"])
def create_user():
    """Create/provision a new user account"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    role = data.get("role", "Guest").strip()
    status = data.get("status", "active").strip().lower()
    performed_by = data.get("performed_by", "api")
    
    # Validation
    if not username:
        return jsonify({"error": "Username is required"}), 400
    
    if not validate_username(username):
        return jsonify({"error": "Username must be 3-50 characters, alphanumeric with _ or -"}), 400
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    if not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400
    
    if role not in AVAILABLE_ROLES:
        return jsonify({
            "error": f"Invalid role. Available roles: {', '.join(AVAILABLE_ROLES)}"
        }), 400
    
    if status not in AVAILABLE_STATUSES:
        return jsonify({
            "error": f"Invalid status. Available statuses: {', '.join(AVAILABLE_STATUSES)}"
        }), 400
    
    now = datetime.utcnow().isoformat()
    
    conn = get_db_connection()
    try:
        # Check for existing user
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            (username, email)
        ).fetchone()
        
        if existing:
            return jsonify({"error": "User with this username or email already exists"}), 409
        
        cursor = conn.execute(
            """
            INSERT INTO users (username, email, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (username, email, role, status, now, now)
        )
        
        user_id = cursor.lastrowid
        
        log_action(
            conn,
            "create",
            username,
            f"email={email};role={role};status={status}",
            performed_by
        )
        
        conn.commit()
        logger.info(f"User provisioned: {username} ({email}) with role {role}")
        
        return jsonify({
            "success": True,
            "message": "User provisioned successfully",
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "role": role,
                "status": status,
                "created_at": now
            }
        }), 201
    except sqlite3.IntegrityError as e:
        logger.error(f"Database integrity error: {e}")
        return jsonify({"error": "User with this username or email already exists"}), 409
    finally:
        conn.close()


@app.route("/api/provision/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    """Update an existing user account"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    performed_by = data.get("performed_by", "api")
    
    conn = get_db_connection()
    try:
        # Check if user exists
        existing = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not existing:
            return jsonify({"error": "User not found"}), 404
        
        updates = []
        params = []
        changes = []
        
        if "username" in data:
            username = data["username"].strip()
            if not validate_username(username):
                return jsonify({"error": "Invalid username format"}), 400
            updates.append("username = ?")
            params.append(username)
            changes.append(f"username={username}")
        
        if "email" in data:
            email = data["email"].strip().lower()
            if not validate_email(email):
                return jsonify({"error": "Invalid email format"}), 400
            updates.append("email = ?")
            params.append(email)
            changes.append(f"email={email}")
        
        if "role" in data:
            role = data["role"].strip()
            if role not in AVAILABLE_ROLES:
                return jsonify({
                    "error": f"Invalid role. Available roles: {', '.join(AVAILABLE_ROLES)}"
                }), 400
            updates.append("role = ?")
            params.append(role)
            changes.append(f"role={role}")
        
        if "status" in data:
            status = data["status"].strip().lower()
            if status not in AVAILABLE_STATUSES:
                return jsonify({
                    "error": f"Invalid status. Available statuses: {', '.join(AVAILABLE_STATUSES)}"
                }), 400
            updates.append("status = ?")
            params.append(status)
            changes.append(f"status={status}")
        
        if not updates:
            return jsonify({"error": "No valid fields to update"}), 400
        
        now = datetime.utcnow().isoformat()
        updates.append("updated_at = ?")
        params.append(now)
        params.append(user_id)
        
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
        conn.execute(query, params)
        
        log_action(
            conn,
            "modify",
            existing["username"],
            ";".join(changes),
            performed_by
        )
        
        conn.commit()
        
        # Get updated user
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        
        logger.info(f"User updated: {existing['username']} - {';'.join(changes)}")
        
        return jsonify({
            "success": True,
            "message": "User updated successfully",
            "user": {
                "id": updated["id"],
                "username": updated["username"],
                "email": updated["email"],
                "role": updated["role"],
                "status": updated["status"],
                "created_at": updated["created_at"],
                "updated_at": updated["updated_at"]
            }
        })
    finally:
        conn.close()


@app.route("/api/provision/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    """Delete a user account"""
    performed_by = request.args.get("performed_by", "api")
    
    conn = get_db_connection()
    try:
        existing = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not existing:
            return jsonify({"error": "User not found"}), 404
        
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        
        log_action(
            conn,
            "delete",
            existing["username"],
            f"email={existing['email']};role={existing['role']}",
            performed_by
        )
        
        conn.commit()
        logger.info(f"User deleted: {existing['username']}")
        
        return jsonify({
            "success": True,
            "message": "User deleted successfully"
        })
    finally:
        conn.close()


@app.route("/api/provision/users/<int:user_id>/disable", methods=["POST"])
def disable_user(user_id):
    """Disable a user account"""
    data = request.get_json() or {}
    performed_by = data.get("performed_by", "api")
    
    conn = get_db_connection()
    try:
        existing = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not existing:
            return jsonify({"error": "User not found"}), 404
        
        if existing["status"] == "disabled":
            return jsonify({"error": "User is already disabled"}), 400
        
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE users SET status = 'disabled', updated_at = ? WHERE id = ?",
            (now, user_id)
        )
        
        log_action(
            conn,
            "disable",
            existing["username"],
            "status=disabled",
            performed_by
        )
        
        conn.commit()
        logger.info(f"User disabled: {existing['username']}")
        
        return jsonify({
            "success": True,
            "message": "User disabled successfully"
        })
    finally:
        conn.close()


@app.route("/api/provision/users/<int:user_id>/enable", methods=["POST"])
def enable_user(user_id):
    """Enable a disabled user account"""
    data = request.get_json() or {}
    performed_by = data.get("performed_by", "api")
    
    conn = get_db_connection()
    try:
        existing = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not existing:
            return jsonify({"error": "User not found"}), 404
        
        if existing["status"] == "active":
            return jsonify({"error": "User is already active"}), 400
        
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE users SET status = 'active', updated_at = ? WHERE id = ?",
            (now, user_id)
        )
        
        log_action(
            conn,
            "enable",
            existing["username"],
            "status=active",
            performed_by
        )
        
        conn.commit()
        logger.info(f"User enabled: {existing['username']}")
        
        return jsonify({
            "success": True,
            "message": "User enabled successfully"
        })
    finally:
        conn.close()


@app.route("/api/provision/users/bulk", methods=["POST"])
def bulk_provision():
    """Bulk provision multiple users"""
    data = request.get_json()
    if not data or "users" not in data:
        return jsonify({"error": "Invalid JSON body. Expected 'users' array"}), 400
    
    users_data = data.get("users", [])
    performed_by = data.get("performed_by", "api")
    
    if not users_data:
        return jsonify({"error": "No users provided"}), 400
    
    if len(users_data) > 100:
        return jsonify({"error": "Maximum 100 users per bulk operation"}), 400
    
    results = {
        "success": [],
        "failed": []
    }
    
    conn = get_db_connection()
    try:
        for user_data in users_data:
            username = user_data.get("username", "").strip()
            email = user_data.get("email", "").strip().lower()
            role = user_data.get("role", "Guest").strip()
            status = user_data.get("status", "active").strip().lower()
            
            # Validate
            if not username or not validate_username(username):
                results["failed"].append({
                    "username": username,
                    "error": "Invalid or missing username"
                })
                continue
            
            if not email or not validate_email(email):
                results["failed"].append({
                    "username": username,
                    "error": "Invalid or missing email"
                })
                continue
            
            if role not in AVAILABLE_ROLES:
                results["failed"].append({
                    "username": username,
                    "error": f"Invalid role: {role}"
                })
                continue
            
            if status not in AVAILABLE_STATUSES:
                status = "active"
            
            now = datetime.utcnow().isoformat()
            
            try:
                cursor = conn.execute(
                    """
                    INSERT INTO users (username, email, role, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (username, email, role, status, now, now)
                )
                
                log_action(
                    conn,
                    "create",
                    username,
                    f"email={email};role={role};status={status};bulk=true",
                    performed_by
                )
                
                results["success"].append({
                    "id": cursor.lastrowid,
                    "username": username,
                    "email": email,
                    "role": role,
                    "status": status
                })
            except sqlite3.IntegrityError:
                results["failed"].append({
                    "username": username,
                    "error": "User already exists"
                })
        
        conn.commit()
        
        logger.info(f"Bulk provision: {len(results['success'])} success, {len(results['failed'])} failed")
        
        return jsonify({
            "success": True,
            "message": f"Processed {len(users_data)} users",
            "created": len(results["success"]),
            "failed": len(results["failed"]),
            "results": results
        })
    finally:
        conn.close()


@app.route("/api/provision/audit", methods=["GET"])
def get_audit_log():
    """Get audit log entries"""
    limit = request.args.get("limit", 100, type=int)
    action_filter = request.args.get("action", "").strip()
    username_filter = request.args.get("username", "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 100)
    
    conn = get_db_connection()
    try:
        query = "SELECT * FROM audit_log WHERE 1=1"
        params = []
        
        if action_filter:
            query += " AND action = ?"
            params.append(action_filter)
        
        if username_filter:
            query += " AND username LIKE ?"
            params.append(f"%{username_filter}%")
        
        # Get total count
        count_query = query.replace("SELECT *", "SELECT COUNT(*)")
        total = conn.execute(count_query, params).fetchone()[0]
        
        # Add pagination and ordering
        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])
        
        rows = conn.execute(query, params).fetchall()
        
        logs = []
        for row in rows:
            logs.append({
                "id": row["id"],
                "action": row["action"],
                "username": row["username"],
                "details": row["details"],
                "performed_by": row["performed_by"],
                "created_at": row["created_at"]
            })
        
        return jsonify({
            "logs": logs,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page
        })
    finally:
        conn.close()


@app.route("/api/provision/roles", methods=["GET"])
def list_roles():
    """List all available roles"""
    return jsonify({
        "roles": AVAILABLE_ROLES
    })


@app.route("/api/provision/statuses", methods=["GET"])
def list_statuses():
    """List all available statuses"""
    return jsonify({
        "statuses": AVAILABLE_STATUSES
    })


@app.route("/api/provision/stats", methods=["GET"])
def get_stats():
    """Get provisioning service statistics"""
    conn = get_db_connection()
    try:
        # Total users
        total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        
        # Users by status
        status_counts = {}
        rows = conn.execute(
            "SELECT status, COUNT(*) as count FROM users GROUP BY status"
        ).fetchall()
        for row in rows:
            status_counts[row["status"]] = row["count"]
        
        # Users by role
        role_counts = {}
        rows = conn.execute(
            "SELECT role, COUNT(*) as count FROM users GROUP BY role"
        ).fetchall()
        for row in rows:
            role_counts[row["role"]] = row["count"]
        
        # Audit log counts
        audit_counts = {}
        rows = conn.execute(
            "SELECT action, COUNT(*) as count FROM audit_log GROUP BY action"
        ).fetchall()
        for row in rows:
            audit_counts[row["action"]] = row["count"]
        
        # Recent activity (last 24 hours)
        yesterday = (datetime.utcnow().timestamp() - 86400)
        recent_count = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE created_at >= ?",
            (datetime.utcfromtimestamp(yesterday).isoformat(),)
        ).fetchone()[0]
        
        return jsonify({
            "service": "account-provisioning",
            "status": "running",
            "total_users": total_users,
            "users_by_status": status_counts,
            "users_by_role": role_counts,
            "audit_actions": audit_counts,
            "recent_activity_24h": recent_count,
            "available_roles": AVAILABLE_ROLES,
            "available_statuses": AVAILABLE_STATUSES,
            "timestamp": int(time.time())
        })
    finally:
        conn.close()


@app.route("/api/provision/report", methods=["GET"])
def generate_report():
    """Generate a security/provisioning report"""
    conn = get_db_connection()
    try:
        # Get action counts
        created = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='create'"
        ).fetchone()[0]
        modified = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='modify'"
        ).fetchone()[0]
        disabled = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='disable'"
        ).fetchone()[0]
        enabled = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='enable'"
        ).fetchone()[0]
        deleted = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='delete'"
        ).fetchone()[0]
        
        # Get current user stats
        total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        active_users = conn.execute(
            "SELECT COUNT(*) FROM users WHERE status='active'"
        ).fetchone()[0]
        disabled_users = conn.execute(
            "SELECT COUNT(*) FROM users WHERE status='disabled'"
        ).fetchone()[0]
        
        report = {
            "title": "Account Provisioning Security Report",
            "generated_at": datetime.utcnow().isoformat(),
            "summary": {
                "total_users": total_users,
                "active_users": active_users,
                "disabled_users": disabled_users
            },
            "activities": {
                "accounts_created": created,
                "accounts_modified": modified,
                "accounts_disabled": disabled,
                "accounts_enabled": enabled,
                "accounts_deleted": deleted
            }
        }
        
        return jsonify(report)
    finally:
        conn.close()


# ================= Error Handlers ==================

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(e):
    logger.error(f"Server error: {e}")
    return jsonify({"error": "Internal server error"}), 500


# ================= Main ==================

# Initialize database on startup
init_db()

if __name__ == "__main__":
    logger.info(f"Starting Account Provisioning Service on {PROVISION_HOST}:{PROVISION_PORT}")
    app.run(
        host=PROVISION_HOST,
        port=PROVISION_PORT,
        debug=os.environ.get("PROVISION_DEBUG", "false").lower() == "true"
    )
