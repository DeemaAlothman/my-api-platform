# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/patients/package*.json ./apps/patients/

RUN npm install

COPY packages ./packages
COPY apps/patients ./apps/patients
COPY tsconfig*.json ./

WORKDIR /app/apps/patients
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/patients/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/apps/patients/dist   ./dist
COPY --from=builder /app/apps/patients/prisma ./prisma

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 4010
CMD ["node", "dist/src/main.js"]
