from flask import Flask, request, jsonify, current_app, Response
import re, html, json, hashlib, time, unicodedata, urllib.parse, os
import requests as http_requests
from collections import defaultdict
from datetime import datetime
from functools import wraps
from typing import Tuple, Optional

app = Flask(__name__)

# ==============================================================================
# Proxy Configuration
# ==============================================================================
MAP_FILE = os.getenv("WAF_MAP_FILE", "/shared/waf-map.json")
PROXY_TIMEOUT = int(os.getenv("WAF_PROXY_TIMEOUT", "30"))

# Hop-by-hop headers that should NOT be forwarded
HOP_BY_HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host"
}

# ==============================================================================
# Initialize empty map file if it doesn't exist
# ==============================================================================
def ensure_map_file_exists():
    """Create an empty map file if it doesn't exist."""
    try:
        map_dir = os.path.dirname(MAP_FILE)
        if map_dir and not os.path.exists(map_dir):
            os.makedirs(map_dir, exist_ok=True)
        if not os.path.exists(MAP_FILE):
            with open(MAP_FILE, "w", encoding="utf-8") as f:
                json.dump({}, f)
            print(f"[WAF] Created empty map file: {MAP_FILE}")
    except Exception as e:
        print(f"[WAF] Warning: Could not create map file: {e}")

def ensure_log_dir_exists():
    """Create log directory if it doesn't exist."""
    try:
        log_dir = os.path.dirname(LOG_FILE)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
    except Exception as e:
        print(f"[WAF] Warning: Could not create log directory: {e}")

RATE_LIMIT = 20           
TIME_WINDOW = 60          
WHITELIST_IPS = set()     
LOG_FILE = os.getenv("WAF_LOG_FILE", "/app/logs/suspicious.log")
SNIPPET_LEN = 150
ENABLED = True
MAX_PAYLOAD_LENGTH = 30000

ALLOWLIST = {
    "/": {"methods": {"GET", "POST"}, "params": None, "content_types": None},
    "/echo": {"methods": {"POST"}, "params": None, "content_types": {"application/json"}},
    "/send-email": {"methods": {"POST"}, "params": {"to", "subject", "body"}, "content_types": {"application/json"}}
}

PATTERNS = {
    "SQL Injection": [
        r"\bunion\b.*\bselect\b",
        r"\bselect\b.*\bfrom\b",
        r"\bdrop\b\s+\btable\b",
        r"\bdrop\b\s+\bdatabase\b",
        r"\binsert\b\s+\binto\b",
        r"\bupdate\b.*\bset\b",
        r"\bdelete\b\s+\bfrom\b",
        r"\bor\b\s+1\s*=\s*1\b",
        r"\bexec\b",
        r"xp_cmdshell",
        r"information_schema",
        r"load_file\s*\(",
        r"outfile\b",
        r"benchmark\s*\(",
        r"\bsleep\s*\("
    ],
    "XSS / HTML Injection": [
        # tags
        r"<\s*script\b",
        r"<\s*iframe\b",
        r"<\s*img\b",
        r"<\s*svg\b",
        r"<\s*math\b",
        r"<\s*object\b",
        r"<\s*embed\b",
        # event handlers or inline JS
        r"\bon\w+\s*=",
        r"javascript\s*:",
        r"data:text/html",
        r"document\.write",
        r"window\.location",
        r"\balert\s*\("
    ],
    "Command Injection": [
        r";\s*", r"\b&&\b", r"\|\|", r"`[^`]*`", r"\$\([^\)]*\)", r"\bwhoami\b", r"\bdir\b", r"\bls\b"
    ],
    "SSTI": [
        r"\{\{.*\}\}", r"\{%.*%\}", r"\$\{.*\}", r"<%.*%>", r"#\{.*\}"
    ],
    "NoSQL / LDAP / XPath": [
        r"\$where", r"\$regex", r"\$gt\b", r"\$lt\b", r"\(uid=", r"objectClass"
    ],
    "Email Header Injection / CRLF": [
        r"[\r\n].*(bcc:|cc:|to:)", r"[\r\n]"
    ],
    "Object / Deserialization": [
        r"O:\d+:\".*\":", r"a:\d+:{", r"pickle\.loads", r"__import__", r"eval\s*\("
    ],
}

# compile for speed
COMPILED = {k: [re.compile(p, re.IGNORECASE | re.DOTALL) for p in v] for k, v in PATTERNS.items()}

requests_log = defaultdict(list)

# ==============================================================================
# Proxy Helper Functions
# ==============================================================================
def resolve_origin(token: str) -> Optional[str]:
    """
    Resolve a WAF proxy token to its origin URL from the shared JSON map file.
    Returns None if token is unknown or map file is unreadable.
    """
    try:
        with open(MAP_FILE, "r", encoding="utf-8") as f:
            mp = json.load(f)
        origin = mp.get(token)
        if not origin:
            return None
        return origin.rstrip("/")
    except Exception:
        return None


def is_proxy_path() -> bool:
    """Check if current request path is a WAF proxy path."""
    return request.path.startswith("/waf/")

def normalize_value(value: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    
    try:
        cur = value
        for _ in range(3):
            dec = urllib.parse.unquote_plus(cur)
            if dec == cur:
                break
            cur = dec
        value = cur
    except Exception:
        pass
    
    try:
        value = html.unescape(value)
    except Exception:
        pass
    
    try:
        value = unicodedata.normalize("NFKC", value)
    except Exception:
        pass
    # strip and collapse whitespace
    value = " ".join(value.strip().split())
    if len(value) > MAX_PAYLOAD_LENGTH:
        value = value[:MAX_PAYLOAD_LENGTH]
    return value

def make_combined_payload() -> str:
    parts = []
    # query params
    try:
        args = request.args.to_dict(flat=True)
        for k, v in args.items():
            parts.append(f"{k}={normalize_value(v)}")
    except Exception:
        pass
    # form
    try:
        form = request.form.to_dict(flat=True)
        for k, v in form.items():
            parts.append(f"{k}={normalize_value(v)}")
    except Exception:
        pass
    # json
    try:
        if request.is_json:
            j = request.get_json(silent=True)
            if isinstance(j, dict):
                for k, v in j.items():
                    parts.append(f"{k}={normalize_value(v)}")
            elif j is not None:
                parts.append(normalize_value(str(j)))
    except Exception:
        pass
    
    try:
        raw = request.get_data(as_text=True) or ""
        if raw:
            parts.append(normalize_value(raw))
    except Exception:
        pass
    combined = " ".join([p for p in parts if p])
    return combined

def _make_snippet_and_hash(payload_text: str) -> Tuple[str, str]:
    if not payload_text:
        return "", ""
    snippet = payload_text[:SNIPPET_LEN]
    phash = hashlib.sha256(payload_text.encode("utf-8", errors="ignore")).hexdigest()
    return snippet, phash

def log_match(ip: str, attack_type: str, pattern: str, method: str, path: str, ua: str, referer: str, payload_text: str) -> None:
    snippet, phash = _make_snippet_and_hash(payload_text or "")
    rec = {
        "time": datetime.utcnow().isoformat() + "Z",
        "ip": ip,
        "attack": attack_type,
        "pattern": pattern,
        "method": method,
        "path": path,
        "ua": ua,
        "referer": referer or "",
        "snippet": snippet,
        "payload_hash": phash
    }
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:
        pass

def is_path_allowed(path: str, method: str, provided_params: set, content_type: str) -> Tuple[bool, str]:
    cfg = ALLOWLIST.get(path)
    if not cfg:
        return True, ""
    if method not in cfg.get("methods", set()):
        return False, "Method not allowed for path"
    allowed_cts = cfg.get("content_types")
    if allowed_cts is not None and content_type is not None:
        ct_main = (content_type or "").split(";")[0].strip().lower()
        if ct_main not in allowed_cts:
            return False, "Content-Type not allowed"
    allowed_params = cfg.get("params")
    if allowed_params is not None and provided_params:
        for p in provided_params:
            if p not in allowed_params:
                return False, f"Parameter '{p}' not allowed"
    return True, ""

def skip_detection(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)
    wrapper._skip_detection = True
    return wrapper

@app.before_request
def waf_before():
    if not ENABLED:
        return None

    ip = request.remote_addr or "unknown"
    method = request.method
    path = request.path
    ua = request.headers.get("User-Agent", "")
    referer = request.headers.get("Referer", "")
    content_type = request.headers.get("Content-Type", "")

    # skip if whitelisted
    if ip in WHITELIST_IPS:
        return None

    # per-route skip
    view_func = request.url_rule and current_app.view_functions.get(request.url_rule.endpoint)
    if view_func and getattr(view_func, "_skip_detection", False):
        return None

    # allowlist validation (params/content-type) - SKIP for proxy paths
    # Proxy traffic goes to user's origin site, so we only do detection + rate limit
    if not is_proxy_path():
        provided_params = set()
        try:
            provided_params.update(request.args.keys())
            provided_params.update(request.form.keys())
            if request.is_json:
                j = request.get_json(silent=True)
                if isinstance(j, dict):
                    provided_params.update(j.keys())
        except Exception:
            pass
        allowed, reason = is_path_allowed(path, method, provided_params, content_type)
        if not allowed:
            combined = make_combined_payload()
            log_match(ip, "AllowListViolation", reason, method, path, ua, referer, combined)
            return jsonify({"error": "Request not allowed (allowlist)"}), 403

    # rate limiting
    now = time.time()
    requests_log[ip] = [t for t in requests_log[ip] if now - t < TIME_WINDOW]
    if len(requests_log[ip]) >= RATE_LIMIT:
        log_match(ip, "RateLimit/DDoS", "rate_limit", method, path, ua, referer, "")
        return jsonify({"error": "Too many requests"}), 429
    requests_log[ip].append(now)

    # build normalized combined payload
    combined_raw = make_combined_payload()
    combined_escaped = html.escape(combined_raw)

    # quick skip for static/image
    if request.path.startswith("/static") or (content_type or "").lower().startswith("image/"):
        return None

    # scan both raw and escaped
    matches = []
    for attack_type, cre_list in COMPILED.items():
        for cre in cre_list:
            try:
                if cre.search(combined_raw):
                    matches.append((attack_type, cre.pattern))
            except re.error:
                continue
    for attack_type, cre_list in COMPILED.items():
        for cre in cre_list:
            try:
                if cre.search(combined_escaped):
                    matches.append((attack_type, cre.pattern))
            except re.error:
                continue

    # dedupe and log
    seen = set()
    unique = []
    for at, pat in matches:
        key = (at, pat)
        if key not in seen:
            seen.add(key)
            unique.append((at, pat))

    if unique:
        for at, pat in unique:
            log_match(ip, at, pat, method, path, ua, referer, combined_raw)
        types = sorted(set([t for t, _ in unique]))
        return jsonify({"error": f"Blocked suspicious input ({', '.join(types)})"}), 403

    return None

@app.after_request
def set_security_headers(response):
    response.headers.setdefault("Content-Security-Policy", "default-src 'self'")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=()")
    response.headers.setdefault("X-XSS-Protection", "0")
    return response

@app.route("/", methods=["GET", "POST"])
def home():
    
    return jsonify({"message": "Secure response"})

@app.route("/echo", methods=["POST"])
def echo():
    ct = (request.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    allowed_cts = ALLOWLIST.get("/echo", {}).get("content_types") or {"application/json"}
    if ct not in allowed_cts:
        combined = make_combined_payload()
        log_match(request.remote_addr or "unknown", "AllowListViolation", "Content-Type not allowed", request.method, request.path, request.headers.get("User-Agent",""), request.headers.get("Referer",""), combined)
        return jsonify({"error": "Content-Type not allowed"}), 415
    data = request.get_json(silent=True)
    return jsonify({"echo": data}), 200

@app.route("/send-email", methods=["POST"])
def send_email():
    ct = (request.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    allowed_cts = ALLOWLIST.get("/send-email", {}).get("content_types") or {"application/json"}
    if ct not in allowed_cts:
        combined = make_combined_payload()
        log_match(request.remote_addr or "unknown", "AllowListViolation", "Content-Type not allowed", request.method, request.path, request.headers.get("User-Agent",""), request.headers.get("Referer",""), combined)
        return jsonify({"error": "Content-Type not allowed"}), 415

    data = request.get_json(force=True, silent=True) or {}
    to = normalize_value(data.get("to", ""))
    subject = normalize_value(data.get("subject", ""))
    body = normalize_value(data.get("body", ""))

    # CRLF in headers
    if re.search(r"[\r\n]", to) or re.search(r"[\r\n]", subject):
        combined = make_combined_payload()
        log_match(request.remote_addr or "unknown", "Email Header Injection (CRLF)", "CRLF_in_field", request.method, request.path, request.headers.get("User-Agent",""), request.headers.get("Referer",""), combined)
        return jsonify({"error": "Blocked suspicious input (Email Header Injection)"}), 403

    #  email format
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", to):
        return jsonify({"error": "Invalid recipient email format"}), 400

    # scan combined
    combined = make_combined_payload()
    matches = []
    for attack_type, cre_list in COMPILED.items():
        for cre in cre_list:
            try:
                if cre.search(combined):
                    matches.append((attack_type, cre.pattern))
            except re.error:
                continue
    seen = set(); uniq = []
    for a, p in matches:
        if (a, p) not in seen:
            seen.add((a, p)); uniq.append((a, p))
    if uniq:
        for a, p in uniq:
            log_match(request.remote_addr or "unknown", a, p, request.method, request.path, request.headers.get("User-Agent",""), request.headers.get("Referer",""), combined)
        return jsonify({"error": "Blocked suspicious input"}), 403

    return jsonify({"message": f"Email simulated to: {to}"}), 200


@app.errorhandler(405)
def handle_405(e):
    combined = make_combined_payload()
    log_match(request.remote_addr or "unknown", "Method Not Allowed (405)", "generic", request.method, request.path, request.headers.get("User-Agent",""), request.headers.get("Referer",""), combined)
    return jsonify({"error": "Method Not Allowed"}), 405

@app.route("/shutdown", methods=["POST"])
@skip_detection
def shutdown():
    func = request.environ.get("werkzeug.server.shutdown")
    if func is None:
        return jsonify({"error": "Not running with the Werkzeug Server"}), 500
    func()
    return jsonify({"message": "Server shutting down..."}), 200


# ==============================================================================
# WAF Reverse Proxy Routes
# ==============================================================================
@app.route("/waf/<token>/", defaults={"path": ""}, methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
@app.route("/waf/<token>/<path:path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
def waf_proxy(token, path):
    """
    Reverse proxy handler for WAF-protected traffic.
    
    Flow:
    1. Resolve token → origin_url from shared JSON map
    2. WAF detection already ran via @app.before_request (blocks if malicious)
    3. Forward request to origin
    4. Return origin response to client
    """
    # Resolve token to origin URL
    origin = resolve_origin(token)
    if not origin:
        return jsonify({"error": "Unknown token"}), 404

    # Build target URL (preserve path and query string)
    upstream_url = origin + "/" + path
    if request.query_string:
        upstream_url += "?" + request.query_string.decode("utf-8", errors="replace")

    # Copy headers, stripping hop-by-hop headers
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in HOP_BY_HOP_HEADERS
    }
    # Add X-Forwarded-* headers for origin visibility
    headers["X-Forwarded-For"] = request.remote_addr or "unknown"
    headers["X-Forwarded-Proto"] = request.scheme
    headers["X-Forwarded-Host"] = request.host

    # Forward request to origin
    try:
        upstream_resp = http_requests.request(
            method=request.method,
            url=upstream_url,
            data=request.get_data(),
            headers=headers,
            cookies=request.cookies,
            allow_redirects=False,
            timeout=PROXY_TIMEOUT,
            stream=True  # Stream for large responses
        )
    except http_requests.exceptions.Timeout:
        return jsonify({"error": "Upstream request timed out"}), 504
    except http_requests.exceptions.ConnectionError:
        return jsonify({"error": "Could not connect to upstream"}), 502
    except http_requests.exceptions.RequestException as e:
        return jsonify({"error": "Upstream request failed"}), 502

    # Build response, stripping hop-by-hop headers from upstream
    resp_headers = [
        (k, v) for k, v in upstream_resp.headers.items()
        if k.lower() not in HOP_BY_HOP_HEADERS
    ]

    return Response(
        upstream_resp.content,
        status=upstream_resp.status_code,
        headers=resp_headers
    )


@app.route("/health", methods=["GET"])
@skip_detection
def health():
    """Health check endpoint for container orchestration."""
    return jsonify({"status": "healthy", "service": "sentinel-waf-flask"}), 200


# ==============================================================================
# Initialize on module load (works with gunicorn)
# ==============================================================================
ensure_map_file_exists()
ensure_log_dir_exists()
print(f"[WAF] Flask WAF started - Map file: {MAP_FILE}, Log file: {LOG_FILE}")


if __name__ == "__main__":
    # Production: use gunicorn or waitress
    # Development: Flask dev server
    host = os.getenv("WAF_HOST", "0.0.0.0")
    port = int(os.getenv("WAF_PORT", "5000"))
    debug = os.getenv("WAF_DEBUG", "false").lower() == "true"
    app.run(host=host, port=port, debug=debug)
