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
COPY apps/gateway ./apps/gateway
COPY tsconfig*.json ./

# Build the gateway service
WORKDIR /app/apps/gateway
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/gateway/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/apps/gateway/dist ./dist

EXPOSE 8000 5000
CMD ["node", "dist/main.js"]
