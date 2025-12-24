# Nginx with embedded configuration for production
FROM nginx:alpine

# Install curl for healthcheck (wget not available in alpine by default)
RUN apk add --no-cache curl

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy both nginx configs (initial for cert issuance, default for SSL)
COPY default-initial.conf /etc/nginx/conf.d/default.conf
COPY default.conf /etc/nginx/conf.d/default-ssl.conf

# Create frontend directory (will be populated by build)
RUN mkdir -p /var/www/frontend /var/www/certbot

# Copy frontend build (from build context)
COPY frontend-dist/ /var/www/frontend/

# Create SSL directory structure (certs will be mounted)
RUN mkdir -p /etc/nginx/ssl/live/cybersentinels.cloud

# Script to switch configs after SSL is ready
RUN echo '#!/bin/sh' > /usr/local/bin/enable-ssl.sh && \
    echo 'if [ -f /etc/nginx/ssl/live/cybersentinels.cloud/fullchain.pem ]; then' >> /usr/local/bin/enable-ssl.sh && \
    echo '  cp /etc/nginx/conf.d/default-ssl.conf /etc/nginx/conf.d/default.conf' >> /usr/local/bin/enable-ssl.sh && \
    echo '  nginx -s reload' >> /usr/local/bin/enable-ssl.sh && \
    echo 'fi' >> /usr/local/bin/enable-ssl.sh && \
    chmod +x /usr/local/bin/enable-ssl.sh

# Health check (using curl instead of wget for alpine compatibility)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
