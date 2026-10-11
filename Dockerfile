# Multi-stage build for Store Management System

# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime environment
FROM node:22-alpine
WORKDIR /app

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy backend code
COPY backend ./backend

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./public

# Copy database schema
COPY backend/db/schema.sql ./backend/db/

# Create logs directory
RUN mkdir -p logs public/ backend/public/avatars backend/public/uploads

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["node", "backend/index.js"]
