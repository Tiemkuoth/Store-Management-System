# Multi-stage build for Store Management System

# Stage 1: Build frontend
FROM node:16-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime environment
FROM node:16-alpine
WORKDIR /app

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy server code
COPY server ./server

# Copy built frontend
COPY --from=frontend-builder /app/dist ./public

# Copy database schema
COPY server/db/schema.sql ./server/db/

# Create logs directory
RUN mkdir -p logs public/avatars

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["node", "server/index.js"]
