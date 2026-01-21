# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages ./packages

# Copy leave service files
COPY apps/leave ./apps/leave

# Install dependencies
RUN npm install

# Build the leave service
WORKDIR /app/apps/leave
RUN npm run build

# Generate Prisma Client (with dummy DATABASE_URL for build time)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy built application from builder
COPY --from=builder /app/apps/leave/dist ./dist
COPY --from=builder /app/apps/leave/package*.json ./
COPY --from=builder /app/apps/leave/prisma ./prisma

# Install production dependencies only
RUN npm install --omit=dev

# Generate Prisma Client in production stage
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Expose the port
EXPOSE 4003

# Start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
