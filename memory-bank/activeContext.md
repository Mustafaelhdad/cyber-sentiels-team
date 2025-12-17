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

## Immediate Next Actions (to be done next)

- Run `composer install` in backend container
- Run `php artisan key:generate && php artisan migrate --seed`
- Scaffold React + Vite + Tailwind in `apps/frontend`
- Build Dashboard + module cards + simple config forms
- Wire Apply button to POST `/api/projects/{id}/runs`
- Implement auth flow UI (login/register forms)

## Open Decisions

- When to introduce Keycloak/SSO and IAM consolidation.
- Exact realtime choice (Reverb vs SSE) after baseline is up.
