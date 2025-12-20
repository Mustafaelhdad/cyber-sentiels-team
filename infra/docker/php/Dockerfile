FROM php:8.3-fpm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    default-mysql-client \
    zip \
    unzip \
    supervisor \
    gosu

# Clear cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql mysqli mbstring exif pcntl bcmath gd opcache

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy PHP configuration (prevents display_errors HTML output)
COPY ./infra/docker/php/php.ini /usr/local/etc/php/conf.d/app.ini

# Set working directory
WORKDIR /var/www/backend

# Copy existing application
COPY ./apps/backend /var/www/backend

# Create shared directory for WAF map file (volume will be mounted here)
# This ensures the directory exists and has correct permissions
RUN mkdir -p /shared /var/log/waf \
    && chown -R www-data:www-data /shared /var/log/waf \
    && chmod 775 /shared /var/log/waf

# Set permissions
RUN chown -R www-data:www-data /var/www/backend

# Copy entrypoint script and fix line endings (Windows CRLF to Unix LF)
COPY ./infra/docker/php/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["php-fpm"]

