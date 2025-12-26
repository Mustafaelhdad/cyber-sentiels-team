# Cyber Sentinels Account Provisioning Frontend
# Multi-stage build for production deployment

# Stage 1: Build
FROM node:20-alpine AS builder

LABEL maintainer="Cyber Sentinels Team"
LABEL org.opencontainers.image.title="Cyber Sentinels Account Provisioning Frontend"
LABEL org.opencontainers.image.description="Frontend UI for IAM Account Provisioning Service"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --silent

# Copy source files
COPY . .

# Build arguments for API URL configuration
ARG VITE_API_URL=http://localhost:5002
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

