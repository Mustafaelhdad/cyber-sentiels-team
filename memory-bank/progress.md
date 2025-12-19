# Progress

## Current Status

- Phase 0 (Repo & Docker Baseline) completed.
- Phase 1a (Laravel Backend Setup) completed.
- Phase 1c (WAF Integration + VPS Deployment Ready) completed.
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
- **ModSecurity WAF + OWASP CRS:**
  - `waf` Docker service as entry point (80/443)
  - `nginx` moved to internal port 8080 behind WAF
  - TLS termination at WAF with Let's Encrypt integration
  - Environment-driven: `WAF_MODE` (DetectionOnly/On), `WAF_PARANOIA` (1-4)
  - Application exclusions for Sanctum/API endpoints
  - Configs at `infra/docker/waf/`
- **VPS Deployment Ready (Hostinger Ubuntu 24.04):**
  - Setup script: `infra/scripts/setup-vps.sh`
  - Certificate scripts: `issue-certs.sh`, `renew-certs.sh`
  - Deploy script: `deploy.sh [staging|prod]`
  - Domains: cybersentinels.cloud, staging.cybersentinels.cloud
  - Full documentation: `docs/DEPLOYMENT.md`

## Next Milestones

- Scaffold React + Vite + Tailwind in `apps/frontend`
- Build Dashboard + module cards + simple config forms
- Wire Apply button to POST runs endpoint
- Add ZAP report viewer component
- Test full auth flow (register/login/logout)
- Wire frontend to SSE log stream for live run progress

## Risks / Notes

- Tool integrations beyond ZAP are deferred; timelines to be set after baseline.
- Run `composer install` inside the backend container to install dependencies
- Run `php artisan key:generate` to generate APP_KEY
- Run `php artisan migrate --seed` to create tables and seed initial users
