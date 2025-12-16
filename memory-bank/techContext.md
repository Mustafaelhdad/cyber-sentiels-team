# Tech Context

## Frontend

- React + Vite, React Router for module pages, TanStack Query for data fetching, Tailwind (default theme for now).
- Pages: Dashboard (3 cards), module config views, runs/tasks, reports/logs viewer, IAM screens.

## Backend

- Laravel 11 REST API.
- Auth: Laravel Sanctum (current). Keycloak/SSO optional later.
- Jobs/Queue: Redis + Horizon for tool execution; Scheduler for maintenance.
- Realtime: Laravel Reverb or SSE for run/task updates.
- Storage: Reports/artifacts under `storage/app/reports/{run_id}/{tool}/...`.

## Data

- Primary DB: PostgreSQL (MySQL acceptable, Postgres preferred for analytics).
- Caching/Queue: Redis.

## Infra

- Docker Compose baseline: nginx, frontend, backend (php-fpm), queue, scheduler, redis, postgres, (optional pgadmin).
- Reverse proxy: Nginx serving React build and proxying `/api`, `/ws`.
- Containers for tools: start with OWASP ZAP (DAST). Later: ModSecurity (WAF), SonarQube (SAST), Wazuh (SIEM), MISP (TIP), n8n (SOAR), Keycloak (IAM/SSO).

## Env & Delivery

- .env per environment (local/staging/prod) with shared samples.
- CI/CD later: build images + deploy via SSH; health checks; backups for DB and artifacts.
