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
COPY apps/zkteco/package*.json     ./apps/zkteco/
COPY apps/jobs/package*.json       ./apps/jobs/
COPY apps/mail/package*.json       ./apps/mail/
COPY apps/gateway/package*.json    ./apps/gateway/

# Step 2: Install all workspace deps (CACHED if no package.json changed)
RUN npm install

# Step 3: Copy source code (won't bust npm cache above)
COPY packages ./packages
COPY apps/mail ./apps/mail
COPY tsconfig*.json ./

WORKDIR /app/apps/mail
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/mail/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/apps/mail/dist   ./dist
COPY --from=builder /app/apps/mail/prisma ./prisma
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

RUN mkdir -p /app/uploads

EXPOSE 4009
CMD ["node", "dist/main.js"]
