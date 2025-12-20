# Progress

## Current Status

- Phase 0 (Repo & Docker Baseline) completed.
- Phase 1a (Laravel Backend Setup) completed.
- Phase 1c (WAF Integration + VPS Deployment Ready) completed.
- Phase 1d (WAF Reverse Proxy MVP) completed.
- **Phase 1e (Flask WAF Replacement) completed.**
- Ready for Phase 1b: Frontend Setup + Auth Flow Integration.

## Completed

- Documented vision, modules, tech stack, architecture flow, and MVP priorities (IAM-first, ZAP-only for Web Security, default UI).
- Mono-repo skeleton created: `apps/frontend`, `apps/backend`, `infra/*`
- Docker Compose baseline with services: nginx, backend (php-fpm), queue (horizon), scheduler, mysql, redis, zap
- Nginx config for frontend static + API proxy + WebSocket ready
- PHP Dockerfile (8.3-fpm + extensions + composer)
- `env.example` + `README.md`
- **Laravel 11 installed** in `apps/backend` with full API structure:
  - Controllers: AuthController, ProjectController, RunController, ReportController
  - Services: AuthService, ProjectService, RunService, ReportService, ZapService
  - Models: User, Project, Run, RunTask
  - Form Requests for validation
  - API Resources for JSON responses
  - Policies for authorization
  - Job: ExecuteToolJob for async tool execution
- Database migrations: users, projects, runs, run_tasks, personal_access_tokens, jobs, cache
- **Sanctum SPA auth fully configured:**
  - Cookie-based session authentication (not token-based)
  - CSRF protection via `/sanctum/csrf-cookie` endpoint
  - Password reset flow with forgot/reset endpoints
  - Proper session regeneration on login/logout
  - Stateful domains for local dev (localhost:5173, :3000, :8000)
- Horizon configured for queue management
- ZAP service integration ready
- **SSE Log Streaming:**
  - `RunStreamController@stream` at `GET /api/projects/{project}/runs/{run}/stream`
  - `RunLogStreamService` handles snapshot/history/tail/heartbeat/done events
  - `ZapService::log()` helper for structured log lines
  - `ExecuteToolJob` instrumented to emit logs at all milestones
- **VPS Deployment Ready (Hostinger Ubuntu 24.04):**
  - Setup script: `infra/scripts/setup-vps.sh`
  - Certificate scripts: `issue-certs.sh`, `renew-certs.sh`
  - Deploy script: `deploy.sh [staging|prod]`
  - Domains: cybersentinels.cloud, staging.cybersentinels.cloud
  - Full documentation: `docs/DEPLOYMENT.md`
- **WAF Reverse Proxy MVP (Backend API):**
  - `WafProxy` model with token, origin_url, status, counters
  - `waf_proxies` migration
  - `WafProxyService` for CRUD, token rotation, map regeneration
  - `WafProxyController` with full API for proxy management
  - `WafLogController` for logs and summary endpoints
  - `waf:update-counters` scheduled command (every minute)
  - `waf:regenerate-map` command for manual token map refresh
  - Frontend: WAF tab on Web Security page
    - `WafProxyCard`, `WafProxyForm`, `WafLogsList`, `WafStatsCard` components
    - Full hooks: `useWafProxies`, `useWafStats`, `useWafLogs`, mutations
- **Flask WAF Proxy (replaced ModSecurity):**
  - `tools/waf/app.py` with reverse proxy + attack detection:
    - SQLi, XSS, SSTI, Command Injection, NoSQL, CRLF detection
    - Token-based origin resolution from JSON map
    - `/waf/<token>/<path>` catch-all routes
    - Rate limiting (20 req/60s per IP)
    - Request forwarding with hop-by-hop header stripping
    - Health check endpoint `/health`
  - `tools/waf/Dockerfile`: Python 3.12-slim + gunicorn
  - `docker-compose.yml`: `sentinel_waf_flask` service + `waf_shared` volume
  - `infra/docker/nginx/default.conf`: `/waf-flask/` routing to Flask WAF
  - Documentation: `docs/WAF_PROXY.md`

## Next Milestones

- Build and test Flask WAF container locally
- Update Laravel backend `WafProxyService` to write JSON map format
- Test WAF proxy flow end-to-end (create proxy, send traffic, view logs)
- Update frontend WAF URL format to `/waf-flask/{token}/`
- Test full auth flow (register/login/logout)
- Wire frontend to SSE log stream for live run progress

## Risks / Notes

- Tool integrations beyond ZAP are deferred; timelines to be set after baseline.
- Run `composer install` inside the backend container to install dependencies
- Run `php artisan key:generate` to generate APP_KEY
- Run `php artisan migrate --seed` to create tables and seed initial users
- Flask WAF reads `/shared/waf-map.json` - backend must write this file on proxy changes
- Local WAF tests: `cd tools/waf && WAF_MAP_FILE=/tmp/waf-map.json python app.py`
