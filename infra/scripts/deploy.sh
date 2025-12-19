#!/bin/bash
# ===================
# DEPLOYMENT SCRIPT
# ===================
# Usage: ./deploy.sh [prod|staging]

set -e

ENV="${1:-staging}"
PROJECT_DIR="/opt/sentinel"
REPO_URL="git@github.com:YOUR_ORG/cyber-sentinels.git"

echo "=== Deploying $ENV environment ==="

# Determine compose files
if [ "$ENV" = "prod" ]; then
    COMPOSE_FILES="-f docker-compose.yml -f infra/docker/compose/docker-compose.prod.yml"
    ENV_FILE="infra/env/env.prod"
    DOMAIN="cybersentinels.cloud"
elif [ "$ENV" = "staging" ]; then
    COMPOSE_FILES="-f docker-compose.yml -f infra/docker/compose/docker-compose.staging.yml"
    ENV_FILE="infra/env/env.staging"
    DOMAIN="staging.cybersentinels.cloud"
else
    echo "Usage: $0 [prod|staging]"
    exit 1
fi

cd "$PROJECT_DIR"

# Pull latest code
echo "=== Pulling latest code ==="
git fetch origin
git checkout $ENV
git pull origin $ENV

# Copy environment file
echo "=== Setting up environment ==="
cp "$ENV_FILE" .env

# Build frontend
echo "=== Building frontend ==="
cd apps/frontend
npm ci
npm run build
cd ../..

# Build and pull images
echo "=== Building Docker images ==="
docker-compose $COMPOSE_FILES build

# Run migrations
echo "=== Running database migrations ==="
docker-compose $COMPOSE_FILES run --rm backend php artisan migrate --force

# Clear and optimize caches
echo "=== Optimizing application ==="
docker-compose $COMPOSE_FILES run --rm backend php artisan config:cache
docker-compose $COMPOSE_FILES run --rm backend php artisan route:cache
docker-compose $COMPOSE_FILES run --rm backend php artisan view:cache

# Restart services
echo "=== Restarting services ==="
docker-compose $COMPOSE_FILES up -d

# Wait for services to be healthy
echo "=== Waiting for services to start ==="
sleep 10

# Health checks
echo "=== Running health checks ==="
curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health || echo "App health check failed"
curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/waf-health || echo "WAF health check failed"

echo "=== Deployment complete ==="
echo "Application: https://$DOMAIN"
echo "WAF logs: docker-compose $COMPOSE_FILES logs waf"


