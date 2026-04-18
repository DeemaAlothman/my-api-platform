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
COPY apps/zkteco/package*.json     ./apps/zkteco/

# Step 2: Install all workspace deps (CACHED if no package.json changed)
RUN npm install --legacy-peer-deps

# Step 3: Copy source code
COPY packages ./packages
COPY apps/zkteco ./apps/zkteco
COPY tsconfig*.json ./

# Generate Prisma Client BEFORE building (types needed at compile time)
WORKDIR /app/apps/zkteco
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Build the zkteco service
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/zkteco/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/apps/zkteco/dist   ./dist
# نسخ الـ generated Prisma client من builder بدل إعادة generate (تجنب Prisma 7 auto-install)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4007
CMD ["node", "dist/src/main.js"]
