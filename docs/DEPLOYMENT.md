# Deployment Guide

## Overview

This guide covers deploying Cyber Sentinels Platform to Hostinger VPS (Ubuntu 24.04 LTS) with:

- ModSecurity WAF + OWASP CRS
- Let's Encrypt TLS certificates
- Production and Staging environments

## Architecture

```
Internet → WAF (ModSecurity + CRS) → Nginx → Laravel/React
                  ↓
           TLS Termination
                  ↓
         Request Inspection
```

**Domains:**

- Production: `https://cybersentinels.cloud`
- Staging: `https://staging.cybersentinels.cloud`

## Prerequisites

1. Hostinger VPS with Ubuntu 24.04 LTS
2. SSH access with sudo privileges
3. DNS access to configure A records

## Step 1: DNS Configuration

Point both domains to your VPS IP address:

```
Type: A    Host: @                           Value: <VPS_IP>
Type: A    Host: staging                     Value: <VPS_IP>
```

Wait for DNS propagation (5-30 minutes).

Verify:

```bash
dig +short cybersentinels.cloud
dig +short staging.cybersentinels.cloud
```

## Step 2: VPS Initial Setup

SSH into your VPS and run the setup script:

```bash
ssh root@<VPS_IP>

# Download and run setup script
curl -sSL https://raw.githubusercontent.com/YOUR_ORG/cyber-sentinels/main/infra/scripts/setup-vps.sh | bash

# Or manually:
apt update && apt upgrade -y
apt install -y docker.io docker-compose git certbot nodejs npm ufw

# Configure firewall
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## Step 3: Clone Repository

```bash
cd /opt
git clone git@github.com:YOUR_ORG/cyber-sentinels.git sentinel
cd sentinel
```

## Step 4: Issue TLS Certificates

### Staging Certificate

```bash
chmod +x infra/scripts/*.sh
./infra/scripts/issue-certs.sh staging
```

### Production Certificate

```bash
./infra/scripts/issue-certs.sh prod
```

**Manual alternative:**

```bash
certbot certonly --standalone -d staging.cybersentinels.cloud --email admin@cybersentinels.cloud --agree-tos
certbot certonly --standalone -d cybersentinels.cloud --email admin@cybersentinels.cloud --agree-tos
```

## Step 5: Deploy Staging

```bash
# Copy staging environment
cp infra/env/env.staging .env

# Edit .env and set secure passwords
nano .env

# Build frontend
cd apps/frontend
npm ci
npm run build
cd ../..

# Start services
docker-compose -f docker-compose.yml -f infra/docker/compose/docker-compose.staging.yml up -d

# Run migrations
docker-compose exec backend php artisan migrate --seed

# Verify
curl https://staging.cybersentinels.cloud/health
curl https://staging.cybersentinels.cloud/waf-health
```

## Step 6: Deploy Production

```bash
# Copy production environment
cp infra/env/env.prod .env

# Edit .env with production passwords
nano .env

# Build and deploy
docker-compose -f docker-compose.yml -f infra/docker/compose/docker-compose.prod.yml up -d

# Run migrations
docker-compose exec backend php artisan migrate --force

# Optimize
docker-compose exec backend php artisan config:cache
docker-compose exec backend php artisan route:cache
docker-compose exec backend php artisan view:cache

# Verify
curl https://cybersentinels.cloud/health
curl https://cybersentinels.cloud/waf-health
```

## WAF Configuration

### Detection vs Blocking Mode

**Detection Only (Staging):**

```env
WAF_MODE=DetectionOnly
WAF_PARANOIA=1
```

**Blocking (Production):**

```env
WAF_MODE=On
WAF_PARANOIA=2
```

### Paranoia Levels

| Level | Description                             | Use Case                |
| ----- | --------------------------------------- | ----------------------- |
| 1     | Minimal rules, very few false positives | Most applications       |
| 2     | Balanced protection                     | Security-conscious apps |
| 3     | Strict rules, may need tuning           | High-security apps      |
| 4     | Maximum protection                      | Critical infrastructure |

### Viewing WAF Logs

```bash
# Real-time logs
docker-compose logs -f waf

# ModSecurity audit log
docker-compose exec waf cat /var/log/modsecurity/modsec_audit.log

# Search for blocked requests
docker-compose exec waf grep "403" /var/log/modsecurity/modsec_audit.log
```

### Adding Custom WAF Rules

Edit `infra/docker/waf/crs-setup.conf` to:

- Exclude paths from certain rules
- Adjust paranoia per endpoint
- Add application-specific exceptions

## Certificate Renewal

Certificates auto-renew via cron job. Verify:

```bash
# Check cron
crontab -l

# Manual renewal test
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal
docker-compose exec waf nginx -s reload
```

## Maintenance Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f waf
```

### Restart Services

```bash
docker-compose restart
docker-compose restart waf
```

### Database Backup

```bash
docker-compose exec mysql mysqldump -u sentinel_prod -p sentinel_prod > backup.sql
```

### Update Application

```bash
git pull origin main
docker-compose build
docker-compose up -d
docker-compose exec backend php artisan migrate --force
```

### Horizon Queue Management

```bash
# Status
docker-compose exec backend php artisan horizon:status

# Pause/Resume
docker-compose exec backend php artisan horizon:pause
docker-compose exec backend php artisan horizon:continue
```

## Troubleshooting

### WAF Blocking Legitimate Requests

1. Check audit log for rule ID:

```bash
docker-compose exec waf tail -100 /var/log/modsecurity/modsec_audit.log | grep -A5 "id"
```

2. Add exclusion to `crs-setup.conf`:

```apache
SecRule REQUEST_URI "@beginsWith /api/your-endpoint" \
    "id:1000010,phase:1,pass,nolog,ctl:ruleRemoveById=RULE_ID"
```

3. Rebuild and restart WAF:

```bash
docker-compose up -d --build waf
```

### SSL Certificate Issues

```bash
# Check certificate
openssl s_client -connect cybersentinels.cloud:443 -servername cybersentinels.cloud

# Verify cert files exist
ls -la /etc/letsencrypt/live/cybersentinels.cloud/
```

### Container Not Starting

```bash
# Check logs
docker-compose logs waf
docker-compose logs backend

# Check resources
docker stats

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Generate new `APP_KEY` with `php artisan key:generate`
- [ ] Set `APP_DEBUG=false` in production
- [ ] WAF is in blocking mode (`WAF_MODE=On`)
- [ ] Firewall only allows 22, 80, 443
- [ ] MySQL/Redis not exposed externally
- [ ] HTTPS redirects enabled
- [ ] Horizon dashboard IP-restricted

## Useful Docker Commands

```bash
# Service status
docker-compose ps

# Enter container shell
docker-compose exec backend sh
docker-compose exec waf sh

# Resource usage
docker stats

# Clean up
docker system prune -a
```


