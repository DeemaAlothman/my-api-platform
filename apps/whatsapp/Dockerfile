FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/whatsapp/package*.json ./apps/whatsapp/

RUN npm install --legacy-peer-deps

COPY packages ./packages
COPY apps/whatsapp ./apps/whatsapp
COPY tsconfig*.json ./

WORKDIR /app/apps/whatsapp
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=whatsapp" npx prisma@6 generate
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/whatsapp/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/apps/whatsapp/dist   ./dist
COPY --from=builder /app/apps/whatsapp/prisma ./prisma
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=whatsapp" npx prisma@6 generate

# مجلد جلسة واتساب (رمز QR) — لازم يكون volume دائم بالـcompose، وإلا كل نشر جديد
# بيحتاج مسح QR من جديد
VOLUME ["/app/wa-auth"]
ENV WHATSAPP_AUTH_DIR=/app/wa-auth

EXPOSE 4022
CMD ["node", "dist/apps/whatsapp/src/main.js"]
