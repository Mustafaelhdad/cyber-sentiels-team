# WAF Reverse Proxy (Flask)

This document describes how to set up and use the Flask-based WAF reverse proxy feature.

## Overview

The WAF Proxy feature allows users to:

1. Enter an Origin URL (the real target website) in the UI
2. Receive a WAF URL (a tokenized proxy endpoint)
3. Send traffic to the WAF URL for inspection by the Flask WAF
4. View logs and traffic counters in the UI

## Architecture

```
User traffic → Nginx Gateway → Flask WAF → Origin Server
                                   ↓
                          Attack Detection
                          (SQL injection, XSS, etc.)
                                   ↓
                             Logs + Block
                                   ↓
                          Backend API → Frontend UI
```

### Request Flow

```
Client Request
      ↓
https://cybersentinels.cloud/waf-flask/{token}/path
      ↓
Nginx Gateway (port 80/443)
      ↓
rewrite /waf-flask/{token}/... → /waf/{token}/...
      ↓
Flask WAF (port 5000)
      ↓
1. Rate limiting check
2. Attack pattern detection (SQLi, XSS, SSTI, etc.)
3. If malicious → Block (403) + Log
4. If clean → Forward to origin_url
      ↓
Origin Server Response → Client
```

### Components

1. **Flask WAF Container** (`sentinel_waf_flask`): Python Flask app with attack detection
2. **Nginx Gateway** (`sentinel_nginx`): Public entry point, routes /waf-flask/ to Flask WAF
3. **Backend API**: Laravel endpoints for proxy management and log access
4. **Frontend UI**: React components for WAF configuration and monitoring

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# WAF Configuration
WAF_BASE_URL=https://cybersentinels.cloud  # Public WAF URL
WAF_DEBUG=false                             # Enable debug mode (dev only)
WAF_PROXY_TIMEOUT=30                        # Upstream timeout in seconds
```

### Docker Volumes

The following volumes are used for WAF:

- `waf_shared`: Token-to-origin mapping file (backend writes, WAF reads)
- `waf_logs`: Flask WAF suspicious activity logs

### Token Map Format

The token map is a JSON file at `/shared/waf-map.json`:

```json
{
  "abc123xyz789...": "https://example.com",
  "def456uvw012...": "https://another-site.org"
}
```

Backend writes this file when proxies are created/updated. Flask WAF reads it for token→origin resolution.

## API Endpoints

All endpoints are under `/api/projects/{project}/waf/`:

### Proxy Management

| Method | Endpoint                          | Description                          |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/proxies`                        | List all WAF proxies for the project |
| POST   | `/proxies`                        | Create a new WAF proxy               |
| GET    | `/proxies/{proxy}`                | Get a specific proxy                 |
| PUT    | `/proxies/{proxy}`                | Update a proxy                       |
| DELETE | `/proxies/{proxy}`                | Delete a proxy                       |
| POST   | `/proxies/{proxy}/rotate-token`   | Regenerate the proxy token           |
| POST   | `/proxies/{proxy}/pause`          | Pause the proxy                      |
| POST   | `/proxies/{proxy}/activate`       | Activate a paused proxy              |
| POST   | `/proxies/{proxy}/reset-counters` | Reset traffic counters               |
| GET    | `/stats`                          | Get aggregated statistics            |

### Logging

| Method | Endpoint        | Description                |
| ------ | --------------- | -------------------------- |
| GET    | `/logs`         | Get recent WAF logs        |
| GET    | `/logs/summary` | Get log summary/statistics |

### Example: Create a WAF Proxy

```bash
curl -X POST https://api.cybersentinels.cloud/api/projects/1/waf/proxies \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"origin_url": "https://example.com", "name": "Example Site"}'
```

Response:

```json
{
  "message": "WAF proxy created successfully",
  "proxy": {
    "id": 1,
    "project_id": 1,
    "name": "Example Site",
    "origin_url": "https://example.com",
    "token": "abc123xyz789...",
    "waf_url": "https://cybersentinels.cloud/waf-flask/abc123xyz789.../",
    "status": "active",
    "counters": {
      "allowed": 0,
      "blocked": 0,
      "total": 0,
      "block_rate": 0
    }
  }
}
```

## Attack Detection

The Flask WAF detects and blocks the following attack types:

| Attack Type                    | Examples                                   |
| ------------------------------ | ------------------------------------------ |
| SQL Injection                  | `' OR 1=1--`, `UNION SELECT`, `DROP TABLE` |
| XSS / HTML Injection           | `<script>`, `javascript:`, `onerror=`      |
| Command Injection              | `; ls`, `&& whoami`, backtick execution    |
| Server-Side Template Injection | `{{...}}`, `${...}`, `<%...%>`             |
| NoSQL / LDAP / XPath           | `$where`, `$regex`, `(uid=)`               |
| Email Header Injection         | CRLF in headers (`\r\n`)                   |
| Object Deserialization         | PHP serialized objects, Python pickle      |

### Rate Limiting

- Default: 20 requests per 60 seconds per IP
- Exceeding the limit returns HTTP 429 (Too Many Requests)

## Usage

### 1. Create a WAF Proxy

1. Go to the Web Security page
2. Select the "WAF Proxy" tab
3. Click "Add WAF Proxy"
4. Enter the origin URL (e.g., `https://your-website.com`)
5. Optionally add a name for the proxy
6. Click "Create WAF Proxy"

### 2. Use the WAF URL

Once created, you'll receive a WAF URL like:

```
https://cybersentinels.cloud/waf-flask/abc123xyz789.../
```

Send your traffic to this URL instead of directly to your origin. The WAF will:

- Inspect the request for malicious patterns
- Block attacks with HTTP 403
- Log all suspicious activity
- Forward clean requests to your origin

### 3. Test the WAF

Test blocking with common attack patterns:

```bash
# SQL Injection test (should be blocked)
curl "https://cybersentinels.cloud/waf-flask/{token}/?id=1' OR '1'='1"

# XSS test (should be blocked)
curl "https://cybersentinels.cloud/waf-flask/{token}/?q=<script>alert(1)</script>"

# SSTI test (should be blocked)
curl "https://cybersentinels.cloud/waf-flask/{token}/?name={{7*7}}"

# Clean request (should pass through)
curl "https://cybersentinels.cloud/waf-flask/{token}/"
```

### 4. Monitor Traffic

View WAF activity in the UI:

- **Counters**: Total requests, allowed, blocked, block rate
- **Recent Logs**: Timestamp, IP, attack type, method, path
- **Statistics**: Traffic breakdown by status

## Docker Setup

### Build and Run

```bash
# Build the Flask WAF container
docker-compose build waf

# Start the stack
docker-compose up -d

# Check WAF health
curl http://localhost:5000/health
```

### Container Services

| Service | Container Name     | Port   | Description     |
| ------- | ------------------ | ------ | --------------- |
| waf     | sentinel_waf_flask | 5000   | Flask WAF proxy |
| nginx   | sentinel_nginx     | 80,443 | Public gateway  |
| backend | sentinel_backend   | 9000   | Laravel PHP-FPM |

## Commands

### Update Counters from Logs

Run manually or via scheduler:

```bash
php artisan waf:update-counters
```

This parses Flask WAF logs to update proxy counters.

### Regenerate Token Map

If the token map file needs regeneration:

```bash
php artisan waf:regenerate-map
```

## Troubleshooting

### Proxy Not Working

1. Check the token map file exists:

   ```bash
   docker exec sentinel_backend cat /shared/waf-map.json
   ```

2. Verify Flask WAF is running:

   ```bash
   docker exec sentinel_waf_flask curl http://localhost:5000/health
   ```

3. Check Flask WAF logs:
   ```bash
   docker logs sentinel_waf_flask
   ```

### Request Blocked Unexpectedly

1. Check the suspicious.log file:

   ```bash
   docker exec sentinel_waf_flask cat /app/suspicious.log
   ```

2. Look for the `attack` field to see what triggered the block
3. Review pattern matches in the `pattern` field

### Logs Not Showing in UI

1. Verify log paths in `.env`:

   ```env
   WAF_LOG_FILE=/var/log/waf/suspicious.log
   ```

2. Check volume mounts are correct in `docker-compose.yml`

3. Run counter update manually:
   ```bash
   php artisan waf:update-counters
   ```

### Token Map Not Updating

1. Check backend can write to the shared volume:

   ```bash
   docker exec sentinel_backend ls -la /shared/
   ```

2. Regenerate manually:
   ```bash
   docker exec sentinel_backend php artisan waf:regenerate-map
   ```

## Security Considerations

1. **Token Security**: WAF proxy tokens are 32-character random strings. Keep them private.
2. **Token Rotation**: Rotate tokens periodically or if compromised.
3. **IP Allowlisting**: Consider adding IP allowlists for sensitive origins (modify WHITELIST_IPS).
4. **Rate Limits**: Adjust RATE_LIMIT and TIME_WINDOW for your traffic patterns.
5. **HTTPS**: Always use HTTPS in production for end-to-end encryption.

## Local Development

For local testing without Docker:

```bash
cd tools/waf

# Install dependencies
pip install flask requests

# Create test token map
echo '{"test123": "https://httpbin.org"}' > /tmp/waf-map.json

# Run Flask WAF
WAF_MAP_FILE=/tmp/waf-map.json python app.py
```

Test locally:

```bash
# Clean request
curl "http://localhost:5000/waf/test123/get"

# Attack (should be blocked)
curl "http://localhost:5000/waf/test123/?id=' OR 1=1--"
```
