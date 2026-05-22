# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/clinic-inventory/package*.json ./apps/clinic-inventory/

RUN npm install

COPY packages ./packages
COPY apps/clinic-inventory ./apps/clinic-inventory
COPY tsconfig*.json ./

WORKDIR /app/apps/clinic-inventory
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/clinic-inventory/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/apps/clinic-inventory/dist   ./dist
COPY --from=builder /app/apps/clinic-inventory/prisma ./prisma

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 4014
CMD ["node", "dist/apps/clinic-inventory/src/main.js"]
