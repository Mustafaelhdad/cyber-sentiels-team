# ===================
# WAF DOCKERFILE
# ===================
# Based on OWASP ModSecurity CRS with nginx
FROM owasp/modsecurity-crs:nginx

# Copy custom configs
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY proxy_params.conf /etc/nginx/includes/proxy_params.conf
COPY modsecurity.conf /etc/modsecurity.d/modsecurity-override.conf
COPY crs-setup.conf /etc/modsecurity.d/owasp-crs/crs-setup.conf

# Switch to root for setup
USER root

# Create directories
RUN mkdir -p /var/www/certbot \
    && mkdir -p /var/log/modsecurity \
    && mkdir -p /etc/nginx/includes \
    && chown -R nginx:nginx /var/log/modsecurity \
    && chown -R nginx:nginx /var/www/certbot

# Add connection upgrade map for WebSocket support
RUN echo 'map $http_upgrade $connection_upgrade { default upgrade; "" close; }' > /etc/nginx/conf.d/00-connection-upgrade.conf

EXPOSE 80 443

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/waf-health || exit 1


