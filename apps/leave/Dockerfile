# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Step 1: Copy ONLY package.json files (enables Docker layer caching)
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
COPY apps/leave ./apps/leave
COPY tsconfig*.json ./

# Build the leave service
WORKDIR /app/apps/leave
RUN npm run build

# Generate Prisma Client (with dummy DATABASE_URL for build time)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/leave/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/apps/leave/dist   ./dist
COPY --from=builder /app/apps/leave/prisma ./prisma
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 4003
CMD ["node", "dist/src/main.js"]
