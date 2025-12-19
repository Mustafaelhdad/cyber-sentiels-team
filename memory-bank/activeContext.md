# Active Context

## Priorities (current)

- Focus MVP on IAM first (Laravel Sanctum auth, basic users/roles/audit in-app).
- Web Security module limited to a ZAP DAST demo (URL input + Apply → run + report).
- Default Tailwind styling; no custom assets yet.
- Monitoring/IR and Keycloak/SSO are later phases.

## Just Completed

- Laravel 11 backend installed with full API structure
- Controllers/Services pattern implemented
- Auth, Projects, Runs, Reports endpoints ready
- Database migrations for core data model
- ZAP service integration for DAST scanning
- Async job processing setup with Horizon
- **Laravel Sanctum SPA authentication fully configured:**
  - Cookie-based session authentication for SPAs
  - CSRF protection via `/sanctum/csrf-cookie` endpoint
  - Password reset flow (forgot-password/reset-password)
  - Session management with proper regeneration
  - Stateful domains configured for local dev (localhost:5173, etc.)
- **SSE Log Streaming implemented:**
  - Endpoint: `GET /api/projects/{project}/runs/{run}/stream`
  - Sanctum session auth required
  - Events: `snapshot`, `log`, `status`, `heartbeat`, `done`
  - Replays historical logs then live-tails new content
  - Structured log format: `[ISO_TIMESTAMP] LEVEL: message`
- **ZAP Docker Configuration:**
  - Docker Compose configured with ZAP service on port 8081 (external) / 8080 (internal)
  - MySQL port changed to 3307 to avoid conflict with local installations
  - Backend `.env` configured with `ZAP_HOST=http://zap:8080`
  - ZAP setup documentation created at `docs/ZAP_SETUP.md`
- **ModSecurity WAF + OWASP CRS implemented:**
  - WAF container as entry point (ports 80/443)
  - Nginx moved behind WAF on internal port 8080
  - TLS termination at WAF layer
  - Configurable modes: DetectionOnly (staging) vs On (prod)
  - Paranoia levels 1-4 for rule strictness
  - Application-specific exclusions for Laravel/Sanctum
  - Let's Encrypt certificate scripts ready
- **Hostinger VPS deployment ready:**
  - Ubuntu 24.04 LTS setup script
  - Staging: staging.cybersentinels.cloud
  - Production: cybersentinels.cloud
  - Certbot automation with renewal cron
  - Full deployment documentation at `docs/DEPLOYMENT.md`

## Immediate Next Actions (to be done next)

- Restart Docker Desktop if hanging, then verify ZAP health check:
  - From host: `curl http://localhost:8081/JSON/core/view/version/`
  - From backend container: `docker exec sentinel_backend curl -s http://zap:8080/JSON/core/view/version/`
- Run full stack: `docker-compose -f docker-compose.yml -f infra/docker/compose/docker-compose.local.yml up -d`
- Run `composer install` in backend container
- Run `php artisan migrate --seed` (APP_KEY already generated)
- Scaffold React + Vite + Tailwind in `apps/frontend`
- Build Dashboard + module cards + simple config forms
- Wire Apply button to POST `/api/projects/{id}/runs`
- Implement auth flow UI (login/register forms)
  - Frontend must call `GET /sanctum/csrf-cookie` before login/register
  - Use `credentials: 'include'` in fetch requests for cookies

## Open Decisions

- When to introduce Keycloak/SSO and IAM consolidation.
- SSE chosen for realtime (simpler than Reverb for MVP; can add Reverb later if needed).
