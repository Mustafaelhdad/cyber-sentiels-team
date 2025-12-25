"""
Cyber Sentinels Authentication Service API
Provides user authentication, JWT token generation, and OTP verification.
"""

import base64
import hashlib
import hmac
import json
import os
import time
import logging
from functools import wraps

from flask import Flask, request, jsonify

# ================= Configuration ==================
JWT_SECRET = os.environ.get("AUTH_JWT_SECRET", "dev-secret-change-me")
JWT_TTL_SECONDS = int(os.environ.get("AUTH_JWT_TTL", "3600"))
STATIC_OTP = os.environ.get("AUTH_STATIC_OTP", "5555")
AUTH_HOST = os.environ.get("AUTH_HOST", "0.0.0.0")
AUTH_PORT = int(os.environ.get("AUTH_PORT", "5000"))
USER_FILE = os.environ.get("AUTH_USER_FILE", "/data/users.txt")
# ==================================================

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("auth-service")

app = Flask(__name__)


# ================= Helper Functions ==================

def ensure_user_file():
    """Ensure user file directory exists"""
    user_dir = os.path.dirname(USER_FILE)
    if user_dir and not os.path.exists(user_dir):
        os.makedirs(user_dir, exist_ok=True)
    if not os.path.exists(USER_FILE):
        with open(USER_FILE, "w") as f:
            pass  # Create empty file


def save_user(username: str, password_hash: str) -> bool:
    """Save user to text file"""
    ensure_user_file()
    try:
        with open(USER_FILE, "a") as f:
            f.write(f"{username},{password_hash}\n")
        logger.info(f"User created: {username}")
        return True
    except Exception as e:
        logger.error(f"Failed to save user: {e}")
        return False


def user_exists(username: str) -> bool:
    """Check if user exists"""
    ensure_user_file()
    if not os.path.exists(USER_FILE):
        return False
    try:
        with open(USER_FILE, "r") as f:
            for line in f:
                if "," not in line:
                    continue
                u, _ = line.strip().split(",", 1)
                if u == username:
                    return True
    except Exception as e:
        logger.error(f"Error checking user: {e}")
    return False


def verify_user(username: str, password: str) -> bool:
    """Verify username and password"""
    ensure_user_file()
    if not os.path.exists(USER_FILE):
        return False
    
    password_hash = hash_password(password)
    try:
        with open(USER_FILE, "r") as f:
            for line in f:
                if "," not in line:
                    continue
                u, p = line.strip().split(",", 1)
                if u == username and p == password_hash:
                    return True
    except Exception as e:
        logger.error(f"Error verifying user: {e}")
    return False


def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def _base64url(data: bytes) -> str:
    """URL-safe base64 encoding without padding"""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_jwt(username: str) -> str:
    """Generate JWT token for user"""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": username, "iat": now, "exp": now + JWT_TTL_SECONDS}
    
    header_b64 = _base64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _base64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = _base64url(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"


def verify_jwt(token: str) -> dict:
    """Verify JWT token and return payload if valid"""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        header_b64, payload_b64, signature_b64 = parts
        
        # Verify signature
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        expected_sig_b64 = _base64url(expected_sig)
        
        if not hmac.compare_digest(signature_b64, expected_sig_b64):
            return None
        
        # Decode payload
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        
        # Check expiration
        if payload.get("exp", 0) < time.time():
            return None
        
        return payload
    except Exception as e:
        logger.error(f"JWT verification failed: {e}")
        return None


def require_auth(f):
    """Decorator to require JWT authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        payload = verify_jwt(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        request.user = payload
        return f(*args, **kwargs)
    return decorated


# Store pending OTP verifications (in production, use Redis)
pending_otps = {}


# ================= API Routes ==================

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "auth",
        "timestamp": int(time.time())
    })


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    """Register a new user"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    
    if user_exists(username):
        return jsonify({"error": "User already exists"}), 409
    
    password_hash = hash_password(password)
    if save_user(username, password_hash):
        return jsonify({
            "success": True,
            "message": "Account created successfully"
        }), 201
    else:
        return jsonify({"error": "Failed to create account"}), 500


@app.route("/api/auth/signin", methods=["POST"])
def signin():
    """Sign in user - Step 1: Verify credentials"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    if verify_user(username, password):
        # Generate a temporary session for OTP verification
        session_id = hashlib.sha256(f"{username}{time.time()}{JWT_SECRET}".encode()).hexdigest()[:32]
        pending_otps[session_id] = {
            "username": username,
            "created_at": time.time(),
            "attempts": 0
        }
        
        logger.info(f"User {username} passed credential verification, awaiting OTP")
        return jsonify({
            "success": True,
            "message": "Credentials verified. Please provide OTP.",
            "session_id": session_id,
            "requires_otp": True
        })
    else:
        logger.warning(f"Failed login attempt for user: {username}")
        return jsonify({"error": "Invalid credentials"}), 401


@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    """Verify OTP - Step 2: Complete authentication"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    session_id = data.get("session_id", "").strip()
    otp_code = data.get("otp", "").strip()
    
    if not session_id or not otp_code:
        return jsonify({"error": "Session ID and OTP are required"}), 400
    
    # Check if session exists
    session = pending_otps.get(session_id)
    if not session:
        return jsonify({"error": "Invalid or expired session"}), 401
    
    # Check session expiration (5 minutes)
    if time.time() - session["created_at"] > 300:
        del pending_otps[session_id]
        return jsonify({"error": "Session expired. Please sign in again."}), 401
    
    # Check max attempts
    if session["attempts"] >= 3:
        del pending_otps[session_id]
        return jsonify({"error": "Too many attempts. Please sign in again."}), 429
    
    session["attempts"] += 1
    
    # Verify OTP
    if otp_code == STATIC_OTP:
        username = session["username"]
        del pending_otps[session_id]
        
        token = generate_jwt(username)
        logger.info(f"User {username} authenticated successfully")
        
        return jsonify({
            "success": True,
            "message": "Authentication successful",
            "token": token,
            "user": username,
            "expires_in": JWT_TTL_SECONDS
        })
    else:
        remaining = 3 - session["attempts"]
        logger.warning(f"Invalid OTP for session {session_id[:8]}..., {remaining} attempts remaining")
        return jsonify({
            "error": "Invalid OTP",
            "attempts_remaining": remaining
        }), 401


@app.route("/api/auth/verify-token", methods=["POST"])
def verify_token():
    """Verify if a JWT token is valid"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400
    
    token = data.get("token", "").strip()
    if not token:
        return jsonify({"error": "Token is required"}), 400
    
    payload = verify_jwt(token)
    if payload:
        return jsonify({
            "valid": True,
            "user": payload.get("sub"),
            "expires_at": payload.get("exp"),
            "issued_at": payload.get("iat")
        })
    else:
        return jsonify({"valid": False, "error": "Invalid or expired token"}), 401


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def get_current_user():
    """Get current authenticated user info"""
    return jsonify({
        "user": request.user.get("sub"),
        "issued_at": request.user.get("iat"),
        "expires_at": request.user.get("exp")
    })


@app.route("/api/auth/users", methods=["GET"])
@require_auth
def list_users():
    """List all registered users (admin endpoint)"""
    ensure_user_file()
    users = []
    try:
        with open(USER_FILE, "r") as f:
            for line in f:
                if "," not in line:
                    continue
                u, _ = line.strip().split(",", 1)
                users.append({"username": u})
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        return jsonify({"error": "Failed to list users"}), 500
    
    return jsonify({
        "users": users,
        "total": len(users)
    })


@app.route("/api/auth/stats", methods=["GET"])
def stats():
    """Get authentication service statistics"""
    ensure_user_file()
    user_count = 0
    try:
        with open(USER_FILE, "r") as f:
            user_count = sum(1 for line in f if "," in line)
    except:
        pass
    
    return jsonify({
        "service": "auth",
        "status": "running",
        "users_registered": user_count,
        "pending_sessions": len(pending_otps),
        "jwt_ttl_seconds": JWT_TTL_SECONDS,
        "timestamp": int(time.time())
    })


# ================= Error Handlers ==================

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(e):
    logger.error(f"Server error: {e}")
    return jsonify({"error": "Internal server error"}), 500


# ================= Main ==================

if __name__ == "__main__":
    logger.info(f"Starting Authentication Service on {AUTH_HOST}:{AUTH_PORT}")
    app.run(host=AUTH_HOST, port=AUTH_PORT, debug=os.environ.get("AUTH_DEBUG", "false").lower() == "true")

