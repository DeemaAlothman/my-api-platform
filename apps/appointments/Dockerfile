# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/appointments/package*.json ./apps/appointments/

RUN npm install

COPY packages ./packages
COPY apps/appointments ./apps/appointments
COPY tsconfig*.json ./

WORKDIR /app/apps/appointments
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/appointments/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/apps/appointments/dist   ./dist
COPY --from=builder /app/apps/appointments/prisma ./prisma

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 4013
CMD ["node", "dist/apps/appointments/src/main.js"]
