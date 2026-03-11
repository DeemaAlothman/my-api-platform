# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Step 1: Copy ONLY package.json files (enables Docker layer caching).
# node_modules is cached as long as package.json files don't change.
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/auth/package*.json       ./apps/auth/
COPY apps/users/package*.json      ./apps/users/
COPY apps/leave/package*.json      ./apps/leave/
COPY apps/attendance/package*.json ./apps/attendance/
COPY apps/evaluation/package*.json ./apps/evaluation/
COPY apps/requests/package*.json   ./apps/requests/
COPY apps/gateway/package*.json    ./apps/gateway/

# Step 2: Install all workspace deps (CACHED if no package.json changed)
RUN npm install

# Step 3: Copy source code (won't bust npm cache above)
COPY packages ./packages
COPY apps/auth ./apps/auth
COPY tsconfig*.json ./

# Build the auth service
WORKDIR /app/apps/auth
RUN npm run build

# Generate Prisma Client (with dummy DATABASE_URL for build time)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy only auth package.json (standalone, no workspace resolution needed)
COPY --from=builder /app/apps/auth/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy built app and prisma schema
COPY --from=builder /app/apps/auth/dist   ./dist
COPY --from=builder /app/apps/auth/prisma ./prisma

# Generate Prisma client
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 4001
CMD ["node", "dist/src/main.js"]
