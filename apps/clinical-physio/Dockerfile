# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/clinical-physio/package*.json ./apps/clinical-physio/

RUN npm install

COPY packages ./packages
COPY apps/clinical-physio ./apps/clinical-physio
COPY tsconfig*.json ./

WORKDIR /app/apps/clinical-physio
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/apps/clinical-physio/dist   ./dist
COPY --from=builder /app/apps/clinical-physio/prisma ./prisma

EXPOSE 4012
CMD ["node", "dist/apps/clinical-physio/src/main.js"]
