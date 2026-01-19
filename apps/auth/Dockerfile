# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages ./packages

# Copy auth service files
COPY apps/auth ./apps/auth

# Install dependencies
RUN npm install

# Build the auth service
WORKDIR /app/apps/auth
RUN npm run build

# Generate Prisma Client
RUN npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy built application from builder
COPY --from=builder /app/apps/auth/dist ./dist
COPY --from=builder /app/apps/auth/package*.json ./
COPY --from=builder /app/apps/auth/prisma ./prisma

# Install production dependencies only
RUN npm install --omit=dev

# Generate Prisma Client in production stage
RUN npx prisma generate

# Expose the port
EXPOSE 4001

# Start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
