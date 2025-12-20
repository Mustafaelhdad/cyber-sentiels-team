#!/bin/sh
set -e

cd /var/www/backend

# Fix permissions on storage and bootstrap/cache
chown -R www-data:www-data /var/www/backend/storage 2>/dev/null || true
chown -R www-data:www-data /var/www/backend/bootstrap/cache 2>/dev/null || true
chmod -R 775 /var/www/backend/storage 2>/dev/null || true
chmod -R 775 /var/www/backend/bootstrap/cache 2>/dev/null || true

# Fix permissions on shared volume for WAF map file
if [ -d "/shared" ]; then
    chown -R www-data:www-data /shared 2>/dev/null || true
    chmod 775 /shared 2>/dev/null || true
    
    # Create waf-map.json if it doesn't exist
    if [ ! -f "/shared/waf-map.json" ]; then
        echo '{}' > /shared/waf-map.json
    fi
    
    chown www-data:www-data /shared/waf-map.json 2>/dev/null || true
    chmod 664 /shared/waf-map.json 2>/dev/null || true
fi

# Fix permissions on waf logs directory
if [ -d "/var/log/waf" ]; then
    chown -R www-data:www-data /var/log/waf 2>/dev/null || true
    chmod 775 /var/log/waf 2>/dev/null || true
fi

# Production setup: Run migrations and caching on first start (php-fpm only)
if [ "$1" = "php-fpm" ]; then
    echo "[Entrypoint] Running Laravel setup..."
    
    # Wait for MySQL to be ready
    echo "[Entrypoint] Waiting for MySQL..."
    MAX_TRIES=30
    TRIES=0
    until php artisan db:monitor --databases=mysql 2>/dev/null || [ $TRIES -eq $MAX_TRIES ]; do
        echo "[Entrypoint] MySQL not ready, retrying in 2s... ($TRIES/$MAX_TRIES)"
        sleep 2
        TRIES=$((TRIES + 1))
    done
    
    if [ $TRIES -eq $MAX_TRIES ]; then
        echo "[Entrypoint] Warning: MySQL may not be ready, continuing anyway..."
    fi
    
    # Run migrations
    echo "[Entrypoint] Running migrations..."
    gosu www-data php artisan migrate --force 2>/dev/null || echo "[Entrypoint] Migration skipped or failed"
    
    # Cache config/routes/views for production
    if [ "${APP_ENV}" = "production" ]; then
        echo "[Entrypoint] Caching for production..."
        gosu www-data php artisan config:cache 2>/dev/null || true
        gosu www-data php artisan route:cache 2>/dev/null || true
        gosu www-data php artisan view:cache 2>/dev/null || true
    fi
    
    echo "[Entrypoint] Laravel setup complete!"
fi

# Execute the command
case "$1" in
    php-fpm)
        exec "$@"
        ;;
    *)
        exec gosu www-data "$@"
        ;;
esac
