"""
Cyber Sentinels Authorization Service API
Provides Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC).
"""

import hashlib
import os
import time
import logging
import json
import re
from functools import wraps

from flask import Flask, request, jsonify

# ================= Configuration ==================
AUTHZ_HOST = os.environ.get("AUTHZ_HOST", "0.0.0.0")
AUTHZ_PORT = int(os.environ.get("AUTHZ_PORT", "5001"))
USER_FILE = os.environ.get("AUTHZ_USER_FILE", "/data/users.txt")
LOG_FILE = os.environ.get("AUTHZ_LOG_FILE", "/data/authorization.log")
DEFAULT_GROUP = os.environ.get("AUTHZ_DEFAULT_GROUP", "general")
ADMIN_PIN = os.environ.get("AUTHZ_ADMIN_PIN", "1234")
# ==================================================

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("authorization-service")

app = Flask(__name__)

# ================= Access Control Configuration ==================
ACCESS_POLICIES = ["RBAC", "ABAC"]

ROLE_PRIVILEGES = {
    "admin": {"read", "write", "delete", "manage"},
    "manager": {"read", "write", "delete"},
    "user": {"read", "write"},
    "member": {"read"},
    "viewer": {"read"},
    "guest": set()
}

ABAC_DENY_GROUPS = {"banned", "suspended", "blocked"}
ABAC_WRITE_BLOCK_GROUPS = {"audit", "viewer", "readonly"}
ABAC_DELETE_GROUPS = {"security", "ops", "admins", "admin"}

# Resource-based permissions
RESOURCE_PERMISSIONS = {
    "dashboard": {"read": ["guest", "member", "user", "manager", "admin"]},
    "reports": {"read": ["member", "user", "manager", "admin"], "write": ["manager", "admin"], "delete": ["admin"]},
    "users": {"read": ["manager", "admin"], "write": ["admin"], "delete": ["admin"]},
    "settings": {"read": ["user", "manager", "admin"], "write": ["admin"]},
    "logs": {"read": ["manager", "admin"], "delete": ["admin"]},
    "security": {"read": ["admin"], "write": ["admin"], "delete": ["admin"], "manage": ["admin"]}
}

# ================= In-Memory Storage ==================
users = {}
_users_last_modified = 0  # Track file modification time


# ================= Helper Functions ==================

def ensure_data_dirs():
    """Ensure data directories exist"""
    for filepath in [USER_FILE, LOG_FILE]:
        dir_path = os.path.dirname(filepath)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)


def load_users(force=False):
    """Load users from file. Automatically reloads if file has changed."""
    global users, _users_last_modified
    ensure_data_dirs()
    
    if not os.path.exists(USER_FILE):
        logger.info(f"User file not found, starting with empty user database")
        users = {}
        _users_last_modified = 0
        return
    
    try:
        # Check if file has been modified since last load
        current_mtime = os.path.getmtime(USER_FILE)
        if not force and current_mtime == _users_last_modified and users:
            return  # No changes, use cached data
        
        new_users = {}
        with open(USER_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 3:
                    continue
                email, password, role = parts[0], parts[1], parts[2]
                group = parts[3] if len(parts) > 3 and parts[3] else DEFAULT_GROUP
                new_users[email] = {
                    "password": password,
                    "role": normalize_role(role),
                    "group": group.lower()
                }
        
        users = new_users
        _users_last_modified = current_mtime
        logger.info(f"Loaded {len(users)} users from {USER_FILE}")
    except Exception as e:
        logger.error(f"Failed to load users: {e}")


def save_users():
    """Save users to file"""
    ensure_data_dirs()
    try:
        with open(USER_FILE, "w") as f:
            f.write("# Cyber Sentinels Authorization Service - User Database\n")
            f.write("# Format: email,password_hash,role,group\n")
            for email, info in users.items():
                group = info.get("group", DEFAULT_GROUP)
                f.write(f"{email},{info['password']},{info['role']},{group}\n")
        logger.info(f"Saved {len(users)} users to {USER_FILE}")
        return True
    except Exception as e:
        logger.error(f"Failed to save users: {e}")
        return False


def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def normalize_role(role: str) -> str:
    """Normalize role name - converts to lowercase and validates"""
    role = role.strip().lower()
    # Note: We no longer convert "member" to "user" as they have different privileges
    # member = read only, user = read + write
    return role


def check_password_strength(password: str) -> dict:
    """Check password strength"""
    issues = []
    strength = "strong"
    
    if len(password) < 8:
        issues.append("Password must be at least 8 characters")
        strength = "weak"
    if not re.search(r"[A-Z]", password):
        issues.append("Password should contain uppercase letter")
        if strength != "weak":
            strength = "medium"
    if not re.search(r"[a-z]", password):
        issues.append("Password should contain lowercase letter")
        if strength != "weak":
            strength = "medium"
    if not re.search(r"[0-9]", password):
        issues.append("Password should contain a number")
        if strength != "weak":
            strength = "medium"
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        issues.append("Password should contain special character")
        if strength == "strong":
            strength = "medium"
    
    return {
        "strength": strength,
        "score": {"weak": 1, "medium": 2, "strong": 3}[strength],
        "issues": issues
    }


def log_authorization(email: str, action: str, resource: str, decision: str, policy: str):
    """Log authorization decisions"""
    ensure_data_dirs()
    try:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE, "a") as f:
            f.write(f"{timestamp},{email},{action},{resource},{decision},{policy}\n")
    except Exception as e:
        logger.error(f"Failed to log authorization: {e}")


# ================= Authorization Engine ==================

def evaluate_rbac(role: str) -> set:
    """Evaluate Role-Based Access Control"""
    role = normalize_role(role)
    return set(ROLE_PRIVILEGES.get(role, set()))


def evaluate_abac(role: str, group: str, context: dict = None) -> set:
    """Evaluate Attribute-Based Access Control"""
    role = normalize_role(role)
    group = group.strip().lower() if group else DEFAULT_GROUP
    
    # Deny all access for banned groups
    if group in ABAC_DENY_GROUPS:
        return set()
    
    # Start with read permission
    privileges = {"read"}
    
    # Add write permission based on role and group
    if role in {"admin", "manager", "user"} and group not in ABAC_WRITE_BLOCK_GROUPS:
        privileges.add("write")
    
    # Add delete permission for admins in specific groups
    if role == "admin" and group in ABAC_DELETE_GROUPS:
        privileges.add("delete")
    
    # Add manage permission for admins
    if role == "admin":
        privileges.add("manage")
    
    # Apply context-based rules if provided
    if context:
        # Time-based restrictions
        if context.get("time_restricted"):
            hour = time.localtime().tm_hour
            if hour < 9 or hour > 17:  # Outside business hours
                privileges.discard("delete")
                privileges.discard("manage")
        
        # IP-based restrictions
        if context.get("external_ip"):
            privileges.discard("delete")
            privileges.discard("manage")
    
    return privileges


def authorize(role: str, group: str, policy: str, context: dict = None) -> set:
    """Main authorization function"""
    policy = policy.strip().upper() if policy else "RBAC"
    
    if policy == "ABAC":
        return evaluate_abac(role, group, context)
    return evaluate_rbac(role)


def check_resource_access(role: str, resource: str, action: str) -> bool:
    """Check if role has access to perform action on resource"""
    role = normalize_role(role)
    
    if resource not in RESOURCE_PERMISSIONS:
        # Default: allow read for authenticated users
        return action == "read" and role != "guest"
    
    allowed_roles = RESOURCE_PERMISSIONS[resource].get(action, [])
    return role in allowed_roles


# ================= API Routes ==================

@app.before_request
def reload_users_if_needed():
    """Reload users from file if it has been modified (for multi-worker support)"""
    load_users()


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "authorization",
        "timestamp": int(time.time())
    })


@app.route("/api/authz/authorize", methods=["POST"])
def authorize_request():
    """Authorize an action for a user"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    email = data.get("email", "").strip()
    action = data.get("action", "read").strip().lower()
    resource = data.get("resource", "").strip()
    policy = data.get("policy", "RBAC").strip().upper()
    context = data.get("context", {})
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    # Get user info
    if email not in users:
        log_authorization(email, action, resource, "DENIED", policy)
        return jsonify({
            "authorized": False,
            "reason": "User not found",
            "email": email,
            "action": action,
            "resource": resource
        }), 403
    
    user = users[email]
    role = user["role"]
    group = user.get("group", DEFAULT_GROUP)
    
    # Get privileges based on policy
    privileges = authorize(role, group, policy, context)
    
    # Check if action is in privileges
    authorized = action in privileges
    
    # If resource specified, also check resource-level permissions
    if resource and authorized:
        authorized = check_resource_access(role, resource, action)
    
    decision = "GRANTED" if authorized else "DENIED"
    log_authorization(email, action, resource, decision, policy)
    
    logger.info(f"Authorization: {email} -> {action} on {resource or 'general'} = {decision}")
    
    return jsonify({
        "authorized": authorized,
        "email": email,
        "role": role,
        "group": group,
        "action": action,
        "resource": resource or "general",
        "policy": policy,
        "privileges": list(privileges),
        "decision": decision
    })


@app.route("/api/authz/privileges", methods=["POST"])
def get_privileges():
    """Get all privileges for a user"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    email = data.get("email", "").strip()
    policy = data.get("policy", "RBAC").strip().upper()
    context = data.get("context", {})
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    if email not in users:
        return jsonify({"error": "User not found"}), 404
    
    user = users[email]
    role = user["role"]
    group = user.get("group", DEFAULT_GROUP)
    
    privileges = authorize(role, group, policy, context)
    
    return jsonify({
        "email": email,
        "role": role,
        "group": group,
        "policy": policy,
        "privileges": list(privileges)
    })


@app.route("/api/authz/users", methods=["GET"])
def list_users():
    """List all users with their roles and groups"""
    user_list = []
    for email, info in users.items():
        user_list.append({
            "email": email,
            "role": info["role"],
            "group": info.get("group", DEFAULT_GROUP)
        })
    
    return jsonify({
        "users": user_list,
        "total": len(user_list)
    })


@app.route("/api/authz/users", methods=["POST"])
def create_user():
    """Create a new user"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "user").strip().lower()
    group = data.get("group", DEFAULT_GROUP).strip().lower()
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    if email in users:
        return jsonify({"error": "User already exists"}), 409
    
    # Check password strength
    strength = check_password_strength(password)
    if strength["strength"] == "weak":
        return jsonify({
            "error": "Password too weak",
            "issues": strength["issues"]
        }), 400
    
    # Validate role
    if role not in ROLE_PRIVILEGES:
        return jsonify({
            "error": f"Invalid role. Valid roles: {', '.join(ROLE_PRIVILEGES.keys())}"
        }), 400
    
    users[email] = {
        "password": hash_password(password),
        "role": normalize_role(role),
        "group": group
    }
    
    if save_users():
        logger.info(f"User created: {email} with role {role}")
        return jsonify({
            "success": True,
            "message": "User created successfully",
            "email": email,
            "role": role,
            "group": group
        }), 201
    else:
        return jsonify({"error": "Failed to save user"}), 500


@app.route("/api/authz/users/<email>", methods=["PUT"])
def update_user(email):
    """Update user role or group"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    if email not in users:
        return jsonify({"error": "User not found"}), 404
    
    new_role = data.get("role", "").strip().lower()
    new_group = data.get("group", "").strip().lower()
    new_password = data.get("password", "").strip()
    
    if new_role:
        if new_role not in ROLE_PRIVILEGES:
            return jsonify({
                "error": f"Invalid role. Valid roles: {', '.join(ROLE_PRIVILEGES.keys())}"
            }), 400
        users[email]["role"] = normalize_role(new_role)
    
    if new_group:
        users[email]["group"] = new_group
    
    if new_password:
        strength = check_password_strength(new_password)
        if strength["strength"] == "weak":
            return jsonify({
                "error": "Password too weak",
                "issues": strength["issues"]
            }), 400
        users[email]["password"] = hash_password(new_password)
    
    if save_users():
        logger.info(f"User updated: {email}")
        return jsonify({
            "success": True,
            "message": "User updated successfully",
            "email": email,
            "role": users[email]["role"],
            "group": users[email]["group"]
        })
    else:
        return jsonify({"error": "Failed to save user"}), 500


@app.route("/api/authz/users/<email>", methods=["DELETE"])
def delete_user(email):
    """Delete a user"""
    if email not in users:
        return jsonify({"error": "User not found"}), 404
    
    del users[email]
    
    if save_users():
        logger.info(f"User deleted: {email}")
        return jsonify({
            "success": True,
            "message": "User deleted successfully"
        })
    else:
        return jsonify({"error": "Failed to save changes"}), 500


@app.route("/api/authz/roles", methods=["GET"])
def list_roles():
    """List all available roles and their privileges"""
    roles = []
    for role, privileges in ROLE_PRIVILEGES.items():
        roles.append({
            "role": role,
            "privileges": list(privileges)
        })
    
    return jsonify({
        "roles": roles,
        "policies": ACCESS_POLICIES
    })


@app.route("/api/authz/resources", methods=["GET"])
def list_resources():
    """List all resources and their permission requirements"""
    resources = []
    for resource, permissions in RESOURCE_PERMISSIONS.items():
        resources.append({
            "resource": resource,
            "permissions": {action: roles for action, roles in permissions.items()}
        })
    
    return jsonify({
        "resources": resources
    })


@app.route("/api/authz/verify", methods=["POST"])
def verify_credentials():
    """Verify user credentials"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    if email not in users:
        return jsonify({"valid": False, "error": "User not found"}), 401
    
    if users[email]["password"] != hash_password(password):
        return jsonify({"valid": False, "error": "Invalid password"}), 401
    
    return jsonify({
        "valid": True,
        "email": email,
        "role": users[email]["role"],
        "group": users[email]["group"]
    })


@app.route("/api/authz/logs", methods=["GET"])
def get_logs():
    """Get authorization logs"""
    limit = request.args.get("limit", 100, type=int)
    
    logs = []
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, "r") as f:
                lines = f.readlines()[-limit:]
                for line in lines:
                    parts = line.strip().split(",")
                    if len(parts) >= 6:
                        logs.append({
                            "timestamp": parts[0],
                            "email": parts[1],
                            "action": parts[2],
                            "resource": parts[3],
                            "decision": parts[4],
                            "policy": parts[5]
                        })
        except Exception as e:
            logger.error(f"Failed to read logs: {e}")
    
    return jsonify({
        "logs": logs,
        "total": len(logs)
    })


@app.route("/api/authz/stats", methods=["GET"])
def stats():
    """Get authorization service statistics"""
    # Count users by role
    role_counts = {}
    for user in users.values():
        role = user["role"]
        role_counts[role] = role_counts.get(role, 0) + 1
    
    # Count users by group
    group_counts = {}
    for user in users.values():
        group = user.get("group", DEFAULT_GROUP)
        group_counts[group] = group_counts.get(group, 0) + 1
    
    return jsonify({
        "service": "authorization",
        "status": "running",
        "total_users": len(users),
        "users_by_role": role_counts,
        "users_by_group": group_counts,
        "available_roles": list(ROLE_PRIVILEGES.keys()),
        "available_policies": ACCESS_POLICIES,
        "timestamp": int(time.time())
    })


@app.route("/api/authz/password-strength", methods=["POST"])
def check_strength():
    """Check password strength"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    password = data.get("password", "")
    result = check_password_strength(password)
    
    return jsonify(result)


# ================= Error Handlers ==================

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(e):
    logger.error(f"Server error: {e}")
    return jsonify({"error": "Internal server error"}), 500


# ================= Main ==================

# Load users on startup
load_users()

if __name__ == "__main__":
    logger.info(f"Starting Authorization Service on {AUTHZ_HOST}:{AUTHZ_PORT}")
    app.run(host=AUTHZ_HOST, port=AUTHZ_PORT, debug=os.environ.get("AUTHZ_DEBUG", "false").lower() == "true")

