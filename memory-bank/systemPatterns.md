# System Patterns

## Architecture Flow

Frontend → API → Queue Jobs → Tool Containers → Reports/Artifacts → Dashboard.

## Suggested Repo Layout (mono-repo)

- `/apps/frontend` (React).
- `/apps/backend` (Laravel).
- `/infra/docker` (compose, nginx, scripts).

## Core Data Model

- projects
- runs (module, target_type, target_value, status/timestamps)
- run_tasks (tool, status, progress, logs_path, report_path, meta_json)

## Execution Pattern

- POST Apply creates a run; jobs dispatched per tool.
- Each tool job updates `run_tasks` and writes reports/logs to storage.
- Normalized vulnerability schema for findings: severity, title, description, evidence, location, tool, timestamp.

## Networking & Realtime

- Nginx proxies `/api` to Laravel and serves React build; `/ws` for Reverb if used.
- Realtime via Reverb channels `runs.{id}` or SSE fallback.

## Tool Sequencing (MVP)

- Start with OWASP ZAP (DAST) for fastest demo.
- Later: ModSecurity (WAF) with generated per-target config; SonarQube (SAST) for repo URLs; RASP script generation.
