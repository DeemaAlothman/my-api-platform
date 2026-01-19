# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages ./packages

# Copy gateway service files
COPY apps/gateway ./apps/gateway

# Install dependencies
RUN npm install

# Build the gateway service
WORKDIR /app/apps/gateway
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy built application from builder
COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/apps/gateway/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Expose ports (will be set by docker-compose)
EXPOSE 8000 5000

# Start the application
CMD ["node", "dist/main.js"]
