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

COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/apps/appointments/dist   ./dist
COPY --from=builder /app/apps/appointments/prisma ./prisma

EXPOSE 4013
CMD ["node", "dist/apps/appointments/src/main.js"]
