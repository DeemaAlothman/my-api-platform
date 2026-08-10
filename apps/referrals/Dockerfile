FROM node:20-alpine AS builder

WORKDIR /app

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
COPY apps/referrals/package*.json  ./apps/referrals/
COPY apps/gateway/package*.json    ./apps/gateway/

RUN npm install --legacy-peer-deps

COPY packages ./packages
COPY apps/referrals ./apps/referrals
COPY tsconfig*.json ./

WORKDIR /app/apps/referrals
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=referrals" npx prisma@6 generate
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/referrals/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/apps/referrals/dist   ./dist
COPY --from=builder /app/apps/referrals/prisma ./prisma
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=referrals" npx prisma@6 generate

EXPOSE 4016
CMD ["node", "dist/apps/referrals/src/main.js"]
