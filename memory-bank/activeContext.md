# Active Context

## Priorities (current)

- Focus MVP on IAM first (Laravel Sanctum auth, basic users/roles/audit in-app).
- Web Security module limited to a ZAP DAST demo (URL input + Apply → run + report).
- Default Tailwind styling; no custom assets yet.
- Monitoring/IR and Keycloak/SSO are later phases.

## Immediate Next Actions (to be done next)

- Bootstrap repo structure (`apps/frontend`, `apps/backend`, `infra/docker`).
- Add docker-compose baseline: nginx, frontend, backend (php-fpm), queue, scheduler, redis, postgres.
- Implement auth flow with Sanctum; seed initial user.
- Build Dashboard + module cards + simple config forms; wire Apply to POST runs.
- Add ZAP job runner and report storage/serving endpoint.

## Open Decisions

- When to introduce Keycloak/SSO and IAM consolidation.
- Exact realtime choice (Reverb vs SSE) after baseline is up.
