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

## Immediate Next Actions (to be done next)

- Run `composer install` in backend container
- Run `php artisan key:generate && php artisan migrate --seed`
- Scaffold React + Vite + Tailwind in `apps/frontend`
- Build Dashboard + module cards + simple config forms
- Wire Apply button to POST `/api/projects/{id}/runs`
- Implement auth flow UI (login/register forms)
  - Frontend must call `GET /sanctum/csrf-cookie` before login/register
  - Use `credentials: 'include'` in fetch requests for cookies

## Open Decisions

- When to introduce Keycloak/SSO and IAM consolidation.
- SSE chosen for realtime (simpler than Reverb for MVP; can add Reverb later if needed).
