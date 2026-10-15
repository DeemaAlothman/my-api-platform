# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/orthotics/package*.json ./apps/orthotics/

RUN npm install

COPY packages ./packages
COPY apps/orthotics ./apps/orthotics
COPY tsconfig*.json ./

WORKDIR /app/apps/orthotics
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/apps/orthotics/dist        ./dist
COPY --from=builder /app/apps/orthotics/prisma      ./prisma

EXPOSE 4019
CMD ["node", "dist/apps/orthotics/src/main.js"]
