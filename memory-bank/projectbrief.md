# Project Brief

## Vision
Unified web platform that orchestrates core cyber security tooling behind simple module-based workflows.

## Modules
- Web Security: WAF, DAST (ZAP first), SAST (repo-based), RASP (agent/script).
- Monitoring & Incident Response: SIEM, TIP, SOAR for ingestion, enrichment, and automated actions.
- IAM: Authentication/Authorization and audit; Sanctum now, Keycloak/SSO later.

## User Journey (high level)
1) Dashboard shows three large module cards (Web Security, Monitoring & IR, IAM).
2) User picks a module and provides a minimal input (URL, log source/API key, users/roles).
3) User clicks Apply; backend fans out to the relevant tools via jobs/containers.
4) Frontend dashboard surfaces task statuses, reports, and alerts in one place.

