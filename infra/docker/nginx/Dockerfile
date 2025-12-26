# Nginx with embedded configuration for production
FROM nginx:alpine

# Install curl and inotify-tools for healthcheck and file watching
RUN apk add --no-cache curl inotify-tools openssl

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy initial config (HTTP only - for cert issuance)
COPY default-initial.conf /etc/nginx/conf.d/default.conf

# Store SSL config in a separate location (not in conf.d to avoid loading)
COPY default.conf /etc/nginx/ssl-config/default-ssl.conf

# Create frontend directory (will be populated by build)
RUN mkdir -p /var/www/frontend /var/www/certbot /etc/nginx/ssl-config

# Copy frontend build (from build context)
COPY frontend-dist/ /var/www/frontend/

# Create SSL directory structure (certs will be mounted)
RUN mkdir -p /etc/nginx/ssl/live/cybersentinels.cloud

# Create entrypoint script that checks for SSL certs on startup and watches for changes
RUN cat > /docker-entrypoint-ssl.sh << 'ENTRYPOINT_EOF'
#!/bin/sh
set -e

SSL_CERT_PATH="/etc/nginx/ssl/live/cybersentinels.cloud/fullchain.pem"
SSL_KEY_PATH="/etc/nginx/ssl/live/cybersentinels.cloud/privkey.pem"
SSL_CONFIG="/etc/nginx/ssl-config/default-ssl.conf"
ACTIVE_CONFIG="/etc/nginx/conf.d/default.conf"
SSL_ENABLED_FLAG="/tmp/ssl_enabled"

# Function to check if SSL certs are valid
check_ssl_certs() {
    if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
        # Verify the certificate is valid
        if openssl x509 -checkend 0 -noout -in "$SSL_CERT_PATH" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to enable SSL config
enable_ssl() {
    if [ ! -f "$SSL_ENABLED_FLAG" ]; then
        echo "$(date): SSL certificates found and valid, enabling HTTPS configuration..."
        cp "$SSL_CONFIG" "$ACTIVE_CONFIG"
        touch "$SSL_ENABLED_FLAG"
        
        # Test nginx config before reload
        if nginx -t 2>/dev/null; then
            echo "$(date): Nginx config valid, reloading..."
            nginx -s reload 2>/dev/null || true
        else
            echo "$(date): Nginx config test failed, keeping current config"
        fi
    fi
}

# Initial check
echo "$(date): === Nginx SSL Entrypoint Starting ==="
if check_ssl_certs; then
    echo "$(date): SSL certificates found, enabling HTTPS configuration..."
    cp "$SSL_CONFIG" "$ACTIVE_CONFIG"
    touch "$SSL_ENABLED_FLAG"
else
    echo "$(date): No valid SSL certificates found, using HTTP-only configuration..."
    echo "$(date): Will watch for certificate creation..."
fi

# Start certificate watcher in background
(
    while true; do
        # Wait for certificate directory to exist
        SSL_DIR=$(dirname "$SSL_CERT_PATH")
        if [ -d "$SSL_DIR" ]; then
            # Watch for certificate changes
            inotifywait -q -e create -e modify -e moved_to "$SSL_DIR" 2>/dev/null || sleep 30
            
            # Give certbot time to finish writing all files
            sleep 5
            
            if check_ssl_certs; then
                enable_ssl
            fi
        else
            # Directory doesn't exist yet, wait and retry
            sleep 30
        fi
    done
) &

# Execute the original nginx entrypoint
exec /docker-entrypoint.sh "$@"
ENTRYPOINT_EOF

RUN chmod +x /docker-entrypoint-ssl.sh

# Health check (using curl instead of wget for alpine compatibility)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint-ssl.sh"]
CMD ["nginx", "-g", "daemon off;"]
