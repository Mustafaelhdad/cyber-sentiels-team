# Cyber Sentinels Platform

A unified cybersecurity platform that integrates multiple security tools under one dashboard.

## Modules

| Module              | Tools                                                 |
| ------------------- | ----------------------------------------------------- |
| **Web Security**    | WAF (ModSecurity), DAST (ZAP), SAST (SonarQube), RASP |
| **Monitoring & IR** | SIEM (Wazuh), TIP (MISP), SOAR (n8n)                  |
| **IAM**             | Authentication, Authorization, Audit (Keycloak)       |

## Tech Stack

- **Frontend**: React + Vite + Tailwind + TanStack Query
- **Backend**: Laravel 11 + Sanctum + Horizon
- **Database**: MySQL 8.0
- **Cache/Queue**: Redis
- **Proxy**: Nginx
- **Containers**: Docker Compose

## Project Structure

```
/
├── apps/
│   ├── frontend/      # React SPA
│   └── backend/       # Laravel API
├── infra/
│   ├── docker/
│   │   ├── compose/   # compose overrides
│   │   ├── nginx/     # nginx configs
│   │   ├── php/       # PHP Dockerfile
│   │   └── tools/     # ZAP, ModSecurity, etc.
│   └── scripts/       # deploy, backup scripts
├── memory-bank/       # project documentation
├── storage/           # reports, artifacts
├── docker-compose.yml
└── .env.example
```

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start services (local)
docker-compose -f docker-compose.yml -f infra/docker/compose/docker-compose.local.yml up -d

# 2b. Start with phpMyAdmin (optional)
docker-compose --profile admin up -d

# Staging
docker-compose -f docker-compose.yml -f infra/docker/compose/docker-compose.staging.yml up -d

# Production
docker-compose -f docker-compose.yml -f infra/docker/compose/docker-compose.prod.yml up -d

# 3. Install backend dependencies
docker-compose exec backend composer install

# 4. Run migrations
docker-compose exec backend php artisan migrate

# 5. Install frontend dependencies
cd apps/frontend && npm install && npm run build
```

## Services

| Service    | Port | Description         |
| ---------- | ---- | ------------------- |
| Nginx      | 80   | Reverse proxy       |
| MySQL      | 3306 | Database            |
| phpMyAdmin | 8080 | DB Admin (optional) |
| Redis      | 6379 | Cache & Queue       |
| ZAP        | 8081 | DAST Scanner        |

## Development

```bash
# Backend logs
docker-compose logs -f backend

# Queue worker
docker-compose logs -f queue

# Frontend dev server
cd apps/frontend && npm run dev
```

## License

Proprietary - Cyber Sentinels Team
