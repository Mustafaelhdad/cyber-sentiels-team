# Nginx with embedded configuration for production
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY default.conf /etc/nginx/conf.d/default.conf

# Create frontend directory (will be populated by build)
RUN mkdir -p /var/www/frontend /var/www/certbot

# Copy frontend build (from build context)
COPY frontend-dist/ /var/www/frontend/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
