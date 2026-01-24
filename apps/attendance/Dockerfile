# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages ./packages

# Copy attendance service files
COPY apps/attendance ./apps/attendance

# Install dependencies
RUN npm install

# Build the attendance service
WORKDIR /app/apps/attendance
RUN npm run build

# Generate Prisma Client (with dummy DATABASE_URL for build time)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy built application from builder
COPY --from=builder /app/apps/attendance/dist ./dist
COPY --from=builder /app/apps/attendance/package*.json ./
COPY --from=builder /app/apps/attendance/prisma ./prisma

# Install production dependencies only
RUN npm install --omit=dev

# Generate Prisma Client in production stage
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Expose the port
EXPOSE 4004

# Start the application
CMD ["node", "dist/src/main.js"]
