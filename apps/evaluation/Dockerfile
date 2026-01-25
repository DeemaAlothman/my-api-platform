# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY apps/evaluation/package*.json ./
COPY apps/evaluation/prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY apps/evaluation/ ./

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY apps/evaluation/package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy prisma
COPY apps/evaluation/prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 4005

# Start application
CMD ["node", "dist/src/main.js"]
