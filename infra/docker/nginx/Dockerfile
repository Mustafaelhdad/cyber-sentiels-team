# Nginx with embedded configuration for production
FROM nginx:alpine

# Install curl for healthcheck (wget not available in alpine by default)
RUN apk add --no-cache curl

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

# Create entrypoint script that checks for SSL certs on startup
RUN echo '#!/bin/sh' > /docker-entrypoint-ssl.sh && \
    echo 'set -e' >> /docker-entrypoint-ssl.sh && \
    echo '' >> /docker-entrypoint-ssl.sh && \
    echo '# Check if SSL certificates exist and switch to SSL config' >> /docker-entrypoint-ssl.sh && \
    echo 'if [ -f /etc/nginx/ssl/live/cybersentinels.cloud/fullchain.pem ]; then' >> /docker-entrypoint-ssl.sh && \
    echo '  echo "SSL certificates found, enabling HTTPS configuration..."' >> /docker-entrypoint-ssl.sh && \
    echo '  cp /etc/nginx/ssl-config/default-ssl.conf /etc/nginx/conf.d/default.conf' >> /docker-entrypoint-ssl.sh && \
    echo 'else' >> /docker-entrypoint-ssl.sh && \
    echo '  echo "No SSL certificates found, using HTTP-only configuration..."' >> /docker-entrypoint-ssl.sh && \
    echo 'fi' >> /docker-entrypoint-ssl.sh && \
    echo '' >> /docker-entrypoint-ssl.sh && \
    echo '# Execute the original nginx entrypoint' >> /docker-entrypoint-ssl.sh && \
    echo 'exec /docker-entrypoint.sh "$@"' >> /docker-entrypoint-ssl.sh && \
    chmod +x /docker-entrypoint-ssl.sh

# Health check (using curl instead of wget for alpine compatibility)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint-ssl.sh"]
CMD ["nginx", "-g", "daemon off;"]
