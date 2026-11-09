FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/cashbox/package*.json ./apps/cashbox/

RUN npm install --legacy-peer-deps

COPY packages ./packages
COPY apps/cashbox ./apps/cashbox
COPY tsconfig*.json ./

WORKDIR /app/apps/cashbox
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=cashbox" npx prisma@6 generate
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/cashbox/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/apps/cashbox/dist   ./dist
COPY --from=builder /app/apps/cashbox/prisma ./prisma
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=cashbox" npx prisma@6 generate

EXPOSE 4020
CMD ["node", "dist/apps/cashbox/src/main.js"]
