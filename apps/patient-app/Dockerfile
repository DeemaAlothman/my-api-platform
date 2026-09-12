# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/patient-app/package*.json ./apps/patient-app/

RUN npm install

COPY packages ./packages
COPY apps/patient-app ./apps/patient-app
COPY tsconfig*.json ./

WORKDIR /app/apps/patient-app
RUN npm run build
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# نسخة مستقلة من package.json (بدون الحاجة لحل workspace) — نفس نمط apps/auth
# الذي يستخدم bcrypt أيضاً: إعادة تثبيت نظيفة في مرحلة production تضمن بناء binding الـnative الصحيح لـalpine
COPY --from=builder /app/apps/patient-app/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/apps/patient-app/dist   ./dist
COPY --from=builder /app/apps/patient-app/prisma ./prisma

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 4017
CMD ["node", "dist/apps/patient-app/src/main.js"]
