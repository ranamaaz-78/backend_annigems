# Stage 1: frontend build (Vite + Tailwind)
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

# Stage 2: Laravel (PHP + Nginx)
FROM serversideup/php:8.3-fpm-nginx

ENV PHP_OPCACHE_ENABLE=1
ENV AUTORUN_ENABLED=true

USER root
RUN install-php-extensions intl gd
USER www-data

COPY --chown=www-data:www-data . /var/www/html

# scribe.php needs a dev-only package, so it would crash artisan with --no-dev
RUN rm -f config/scribe.php && composer install --no-dev --optimize-autoloader --no-interaction

COPY --from=assets --chown=www-data:www-data /app/public/build /var/www/html/public/build
