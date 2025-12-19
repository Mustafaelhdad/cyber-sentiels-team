#!/bin/bash
# ===================
# ISSUE LET'S ENCRYPT CERTIFICATES
# ===================
# Run this on the Hostinger VPS after DNS is pointed
# Usage: ./issue-certs.sh [prod|staging]

set -e

ENV="${1:-prod}"
EMAIL="admin@cybersentinels.cloud"

if [ "$ENV" = "prod" ]; then
    DOMAIN="cybersentinels.cloud"
elif [ "$ENV" = "staging" ]; then
    DOMAIN="staging.cybersentinels.cloud"
else
    echo "Usage: $0 [prod|staging]"
    exit 1
fi

echo "=== Issuing certificate for $DOMAIN ==="

# Stop WAF container temporarily to free port 80
docker-compose stop waf 2>/dev/null || true

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt-get update
    apt-get install -y certbot
fi

# Issue certificate using standalone mode
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN"

# Set permissions for docker
chmod 755 /etc/letsencrypt/live
chmod 755 /etc/letsencrypt/archive
chmod 644 /etc/letsencrypt/live/$DOMAIN/fullchain.pem
chmod 644 /etc/letsencrypt/live/$DOMAIN/privkey.pem

echo "=== Certificate issued for $DOMAIN ==="
echo "Certificates at: /etc/letsencrypt/live/$DOMAIN/"

# Restart WAF container
echo "Restarting WAF container..."
docker-compose start waf

echo "=== Done ==="


