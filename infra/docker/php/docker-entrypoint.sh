#!/bin/sh
set -e

# Fix permissions on shared volume for WAF map file
# The volume is shared between containers, so we need to ensure www-data can write
if [ -d "/shared" ]; then
    chown -R www-data:www-data /shared 2>/dev/null || true
    chmod 775 /shared 2>/dev/null || true
    
    # Create waf-map.json if it doesn't exist
    if [ ! -f "/shared/waf-map.json" ]; then
        echo '{}' > /shared/waf-map.json
    fi
    
    # Fix permissions on existing file
    chown www-data:www-data /shared/waf-map.json 2>/dev/null || true
    chmod 664 /shared/waf-map.json 2>/dev/null || true
fi

# Fix permissions on waf logs directory
if [ -d "/var/log/waf" ]; then
    chown -R www-data:www-data /var/log/waf 2>/dev/null || true
    chmod 775 /var/log/waf 2>/dev/null || true
fi

# Execute the command (php-fpm runs as root, drops to www-data)
# For other commands like artisan, use gosu
case "$1" in
    php-fpm)
        exec "$@"
        ;;
    *)
        exec gosu www-data "$@"
        ;;
esac
