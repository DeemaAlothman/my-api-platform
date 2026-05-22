# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/clinical-prosthetics/package*.json ./apps/clinical-prosthetics/

RUN npm install

COPY packages ./packages
COPY apps/clinical-prosthetics ./apps/clinical-prosthetics
COPY tsconfig*.json ./

WORKDIR /app/apps/clinical-prosthetics
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/apps/clinical-prosthetics/dist   ./dist
COPY --from=builder /app/apps/clinical-prosthetics/prisma ./prisma

EXPOSE 4011
CMD ["node", "dist/apps/clinical-prosthetics/src/main.js"]
