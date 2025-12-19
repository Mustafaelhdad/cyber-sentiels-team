# OWASP ZAP (DAST) Setup Guide

This guide covers setting up and running the OWASP ZAP DAST scanner with the Cyber Sentinels platform.

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Frontend     │──────│  Backend API    │──────│   ZAP Service   │
│  (React SPA)    │      │   (Laravel)     │      │  (Docker)       │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │                        │
                                │                        │
                         ┌──────▼──────┐          ┌──────▼──────┐
                         │   Queue     │          │   Target    │
                         │  (Horizon)  │          │   Website   │
                         └─────────────┘          └─────────────┘
```

- **Frontend** triggers scans via the Web Security module
- **Backend** creates a `Run` and dispatches `ExecuteToolJob` to the queue
- **Queue Worker (Horizon)** executes the job, which calls `ZapService`
- **ZapService** communicates with the ZAP container over HTTP API
- **ZAP** performs spider + active scans on the target URL

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.x
- Port 8081 available (ZAP API)
- Port 3307 available (MySQL - avoids conflict with local MySQL on 3306)

## Environment Configuration

### Backend `.env` (apps/backend/.env)

```env
# ZAP Configuration
ZAP_HOST=http://zap:8080
ZAP_API_KEY=
```

Note: `ZAP_API_KEY` is empty because the ZAP container runs with `api.disablekey=true` for simplicity in local dev. For production, set an API key.

### Docker Network

ZAP runs on the `sentinel_net` Docker network. The backend container connects to ZAP using the container hostname `zap` on port `8080` (internal).

## Starting the Stack

### Local Development

```bash
# Navigate to project root
cd "c:\Users\DEll\Desktop\Work Files\Freelance\Cyber Sentinels team"

# Start core services + ZAP
docker-compose -f docker-compose.yml -f infra/docker/compose/docker-compose.local.yml up -d

# Or start specific services only
docker-compose -f docker-compose.yml -f infra/docker/compose/docker-compose.local.yml up -d mysql redis zap

# Check container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:

```
NAMES            STATUS          PORTS
sentinel_zap     Up X minutes    0.0.0.0:8081->8080/tcp
sentinel_mysql   Up X minutes    0.0.0.0:3307->3306/tcp
sentinel_redis   Up X minutes    0.0.0.0:6379->6379/tcp
```

### Port Mappings

| Service | Internal Port | External Port | Notes                            |
| ------- | ------------- | ------------- | -------------------------------- |
| ZAP     | 8080          | 8081          | API access from host             |
| MySQL   | 3306          | 3307          | Avoids conflict with local MySQL |
| Redis   | 6379          | 6379          | Standard port                    |

## Verifying ZAP is Running

### From Host Machine

```powershell
# PowerShell
(Invoke-WebRequest -Uri "http://localhost:8081/JSON/core/view/version/" -UseBasicParsing).Content

# Expected response:
# {"version":"2.15.0"}
```

```bash
# Git Bash / WSL
curl http://localhost:8081/JSON/core/view/version/
```

### From Backend Container

```bash
docker exec sentinel_backend curl -s http://zap:8080/JSON/core/view/version/
```

### Check ZAP Logs

```bash
docker logs sentinel_zap --tail 100
```

Look for: `ZAP is now listening on 0.0.0.0:8080`

## Triggering a DAST Scan

### Via API (Direct)

```bash
# 1. Login to get session cookie
POST /api/login
{
  "email": "admin@sentinel.local",
  "password": "password"
}

# 2. Create a project (if not exists)
POST /api/projects
{
  "name": "My Web App",
  "description": "Testing ZAP scan"
}

# 3. Start a DAST run
POST /api/projects/{project_id}/runs
{
  "module": "web_security",
  "target_type": "url",
  "target_value": "https://example.com",
  "tools": ["dast"]
}
```

### Via Frontend

1. Navigate to **Web Security** module
2. Go to **DAST** tab
3. Enter target URL (e.g., `https://example.com`)
4. Click **Start Scan**
5. Monitor progress in the Status tab

## Scan Workflow

1. **Run Created** - Backend creates a `Run` record with status `pending`
2. **Job Dispatched** - `ExecuteToolJob` is pushed to Redis queue
3. **Horizon Picks Up** - Queue worker starts processing
4. **Spider Scan** - ZAP crawls the target URL to discover pages
5. **Active Scan** - ZAP performs vulnerability tests on discovered pages
6. **Report Generation** - HTML and JSON reports are saved to storage
7. **Run Completed** - Status updated to `completed`

## Storage Paths

Reports and logs are stored in:

```
storage/app/reports/{run_id}/{tool}/
├── report.html    # Full HTML report
├── report.json    # JSON findings
└── execution.log  # Scan log
```

Example:

```
storage/app/reports/1/dast/
├── report.html
├── report.json
└── execution.log
```

## Viewing Reports

### Via API

```bash
# Get run details with task info
GET /api/projects/{project_id}/runs/{run_id}

# Get report content
GET /api/projects/{project_id}/runs/{run_id}/report
```

### Via Frontend

1. Go to **Web Security** > **DAST**
2. Click on a completed run
3. View **Report** tab for HTML report
4. View **Logs** tab for execution log

### Direct File Access

```bash
# From backend container
docker exec sentinel_backend cat /var/www/backend/storage/app/reports/1/dast/report.html
```

## Troubleshooting

### ZAP Container Won't Start

```bash
# Check logs
docker logs sentinel_zap

# Ensure port 8081 is free
netstat -ano | findstr :8081

# Restart container
docker restart sentinel_zap
```

### "ZAP service is not available" Error

1. Verify ZAP container is running: `docker ps | findstr zap`
2. Check backend can reach ZAP:
   ```bash
   docker exec sentinel_backend curl -s http://zap:8080/JSON/core/view/version/
   ```
3. Verify `ZAP_HOST` in `.env` is `http://zap:8080` (not localhost)

### Scan Stuck at 0%

1. Check queue worker is running: `docker ps | findstr queue`
2. Check Horizon logs: `docker logs sentinel_queue`
3. Verify Redis is reachable: `docker exec sentinel_backend php artisan tinker --execute="Redis::ping()"`

### Connection Timeout

ZAP takes 30-60 seconds to fully initialize. Wait for logs to show:

```
ZAP is now listening on 0.0.0.0:8080
```

## Production Deployment

### docker-compose.prod.yml

In production, ZAP runs with the `tools` profile and doesn't auto-start:

```yaml
zap:
  profiles:
    - tools # Only start when explicitly needed
  restart: "no"
```

Start ZAP only when needed:

```bash
docker-compose --profile tools up -d zap
```

### Security Considerations

1. **Enable API Key** - Set `ZAP_API_KEY` in production
2. **Network Isolation** - ZAP should only be accessible from backend, not exposed externally
3. **Resource Limits** - Set memory/CPU limits in compose file
4. **Scan Targets** - Only scan authorized targets

### Production ZAP Command

Update the ZAP command in `docker-compose.yml` to use an API key:

```yaml
zap:
  command: >
    zap.sh -daemon -host 0.0.0.0 -port 8080
    -config api.addrs.addr.name=.*
    -config api.addrs.addr.regex=true
    -config api.key=${ZAP_API_KEY}
```

## Useful ZAP API Endpoints

| Endpoint                               | Description              |
| -------------------------------------- | ------------------------ |
| `/JSON/core/view/version/`             | Get ZAP version          |
| `/JSON/spider/action/scan/?url=TARGET` | Start spider scan        |
| `/JSON/spider/view/status/?scanId=ID`  | Get spider progress      |
| `/JSON/ascan/action/scan/?url=TARGET`  | Start active scan        |
| `/JSON/ascan/view/status/?scanId=ID`   | Get active scan progress |
| `/JSON/core/view/alerts/`              | Get all findings         |
| `/OTHER/core/other/htmlreport/`        | Get HTML report          |
| `/JSON/core/action/newSession/`        | Clear session            |

Full API documentation: https://www.zaproxy.org/docs/api/

## Common Docker Commands

```bash
# Start all services
docker-compose -f docker-compose.yml -f infra/docker/compose/docker-compose.local.yml up -d

# Stop all services
docker-compose down

# Stop and remove volumes (CAUTION: deletes data)
docker-compose down -v

# View ZAP logs
docker logs -f sentinel_zap

# Execute command in ZAP container
docker exec -it sentinel_zap bash

# Restart ZAP only
docker restart sentinel_zap

# Check container resource usage
docker stats sentinel_zap

# Pull latest ZAP image
docker pull ghcr.io/zaproxy/zaproxy:stable
```
