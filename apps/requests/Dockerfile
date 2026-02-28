FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages ./packages
COPY apps/requests ./apps/requests

RUN npm install

WORKDIR /app/apps/requests
RUN npm run build
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

COPY --from=builder /app/apps/requests/dist ./dist
COPY --from=builder /app/apps/requests/package*.json ./
COPY --from=builder /app/apps/requests/prisma ./prisma

RUN npm install --omit=dev

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 4006

CMD ["node", "dist/main.js"]
