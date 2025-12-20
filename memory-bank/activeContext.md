# Active Context

## Priorities (current)

- Focus MVP on IAM first (Laravel Sanctum auth, basic users/roles/audit in-app).
- Web Security module: Flask WAF reverse proxy + ZAP DAST demo.
- Default Tailwind styling; no custom assets yet.
- Monitoring/IR and Keycloak/SSO are later phases.

## Just Completed

- **Flask WAF Proxy (replaced ModSecurity):**
  - `tools/waf/app.py` updated with reverse proxy mode:
    - Token-based origin resolution from `/shared/waf-map.json`
    - Catch-all `/waf/<token>/<path>` routes
    - Request forwarding via `requests` library
    - Hop-by-hop header stripping
    - Upstream timeout/error handling
    - Allowlist enforcement skipped for `/waf/` paths (keeps detection + rate limit)
  - `tools/waf/Dockerfile` created:
    - Python 3.12-slim base image
    - Gunicorn for production (4 workers)
    - Health check endpoint `/health`
  - `docker-compose.yml` updated:
    - New `waf` service using Flask WAF (`sentinel_waf_flask`)
    - Shared volume `waf_shared` for token map JSON
    - Backend/queue worker volumes updated
    - Removed ModSecurity/OWASP CRS service
  - `infra/docker/nginx/default.conf` updated:
    - Nginx now public gateway on port 80/443
    - `/waf-flask/` location block with rewrite to `/waf/`
    - Proxy to `waf_flask` upstream
    - Certbot ACME challenge location
  - Documentation updated at `docs/WAF_PROXY.md`

## Immediate Next Actions (to be done next)

- Build Flask WAF container: `docker-compose build waf`
- Restart stack: `docker-compose up -d`
- Create initial token map: `echo '{}' > /shared/waf-map.json` (or via backend)
- Test WAF proxy flow:
  1. Create a project and WAF proxy via UI (or API)
  2. Copy the WAF URL (`/waf-flask/{token}/`)
  3. Send test requests (including attack payloads)
  4. Verify blocks (403) and logs update
- Update Laravel backend to write JSON token map instead of Nginx map format
- Update frontend to use `/waf-flask/{token}/` URL format

## Open Decisions

- When to introduce Keycloak/SSO and IAM consolidation.
- SSE chosen for realtime (simpler than Reverb for MVP; can add Reverb later if needed).
- WAF token map: Flask WAF reads JSON file; backend needs to regenerate on proxy changes.
