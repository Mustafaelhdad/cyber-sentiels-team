#!/bin/bash
# ===================
# RENEW LET'S ENCRYPT CERTIFICATES
# ===================
# Add to crontab: 0 3 * * * /opt/sentinel/infra/scripts/renew-certs.sh >> /var/log/certbot-renew.log 2>&1

set -e

PROJECT_DIR="/opt/sentinel"
cd "$PROJECT_DIR"

echo "=== Certificate renewal check at $(date) ==="

# Attempt renewal (certbot only renews if within 30 days of expiry)
certbot renew --quiet

# Reload WAF to pick up new certificates
if docker-compose ps | grep -q "sentinel_waf"; then
    echo "Reloading WAF container..."
    docker-compose exec -T waf nginx -s reload
    echo "WAF reloaded successfully"
fi

echo "=== Renewal check complete ==="


