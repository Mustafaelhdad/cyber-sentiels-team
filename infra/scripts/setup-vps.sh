#!/bin/bash
# ===================
# HOSTINGER VPS INITIAL SETUP
# ===================
# Run this once on a fresh Ubuntu 24.04 VPS
# Usage: curl -sSL https://raw.githubusercontent.com/.../setup-vps.sh | bash

set -e

echo "=== Sentinel Platform VPS Setup ==="
echo "Target: Ubuntu 24.04 LTS on Hostinger"

# Update system
echo "=== Updating system packages ==="
apt-get update
apt-get upgrade -y

# Install dependencies
echo "=== Installing dependencies ==="
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    unzip \
    ufw

# Install Docker
echo "=== Installing Docker ==="
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose standalone (for compose file v2 syntax)
echo "=== Installing Docker Compose ==="
if ! command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Install certbot
echo "=== Installing Certbot ==="
apt-get install -y certbot

# Install Node.js (for frontend builds)
echo "=== Installing Node.js ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Configure firewall
echo "=== Configuring firewall ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create project directory
echo "=== Creating project directory ==="
mkdir -p /opt/sentinel
chown -R $SUDO_USER:$SUDO_USER /opt/sentinel 2>/dev/null || true

# Setup log rotation for WAF logs
echo "=== Configuring log rotation ==="
cat > /etc/logrotate.d/sentinel << 'EOF'
/opt/sentinel/storage/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
}

/var/log/modsecurity/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
}
EOF

# Setup certbot renewal cron
echo "=== Setting up certificate renewal ==="
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/sentinel/infra/scripts/renew-certs.sh >> /var/log/certbot-renew.log 2>&1") | crontab -

echo "=== VPS Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Clone your repository to /opt/sentinel"
echo "2. Point DNS A records to this server's IP:"
echo "   - cybersentinels.cloud -> $(curl -s ifconfig.me)"
echo "   - staging.cybersentinels.cloud -> $(curl -s ifconfig.me)"
echo "3. Run: cd /opt/sentinel && ./infra/scripts/issue-certs.sh staging"
echo "4. Run: ./infra/scripts/deploy.sh staging"
echo "5. Repeat steps 3-4 for prod"


