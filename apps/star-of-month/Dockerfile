FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/star-of-month/package*.json ./apps/star-of-month/

RUN npm install --legacy-peer-deps

COPY packages ./packages
COPY apps/star-of-month ./apps/star-of-month
COPY tsconfig*.json ./

WORKDIR /app/apps/star-of-month
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=star_of_month" npx prisma@6 generate
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/star-of-month/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/apps/star-of-month/dist   ./dist
COPY --from=builder /app/apps/star-of-month/prisma ./prisma
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=star_of_month" npx prisma@6 generate

EXPOSE 4021
CMD ["node", "dist/apps/star-of-month/src/main.js"]
