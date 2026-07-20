# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/podiatry/package*.json ./apps/podiatry/

RUN npm install

COPY packages ./packages
COPY apps/podiatry ./apps/podiatry
COPY tsconfig*.json ./

WORKDIR /app/apps/podiatry
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/apps/podiatry/dist        ./dist
COPY --from=builder /app/apps/podiatry/prisma      ./prisma

EXPOSE 4015
CMD ["node", "dist/apps/podiatry/src/main.js"]
