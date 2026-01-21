# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages ./packages

# Copy users service files
COPY apps/users ./apps/users

# Install dependencies
RUN npm install

# Build the users service
WORKDIR /app/apps/users
RUN npm run build

# Generate Prisma Client (with dummy DATABASE_URL for build time)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy built application from builder
COPY --from=builder /app/apps/users/dist ./dist
COPY --from=builder /app/apps/users/package*.json ./
COPY --from=builder /app/apps/users/prisma ./prisma

# Install production dependencies only
RUN npm install --omit=dev

# Generate Prisma Client in production stage
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Expose the port
EXPOSE 4002

# Start the application
CMD ["node", "dist/src/main.js"]
