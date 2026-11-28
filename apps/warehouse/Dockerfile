# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/warehouse/package*.json ./apps/warehouse/

RUN npm install

COPY packages ./packages
COPY apps/warehouse ./apps/warehouse
COPY tsconfig*.json ./

WORKDIR /app/apps/warehouse
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# تُنصَّب تبعياتُ هذه الخدمة من بيانها هي، ولا تُنسَخ شجرةُ الجذر من مرحلة البناء.
# فالجذرُ يُعرِّف مساحةَ عملٍ أعضاؤها كلُّ التطبيقات، ولا يُنسَخ إلى البناء إلا
# بيانُ هذه الخدمة — فتخرج الشجرةُ ناقصةً من حزمةٍ تُعلِنها الخدمةُ وتَلزمها،
# فتقلع فلا تجدها. وكان الكاشُ يُخفي ذلك حتى أُفرِغ. وهو عينُ ما تفعله خدماتُ
# users وcashbox وغيرُها، وأخفُّ حجماً.
COPY --from=builder /app/apps/warehouse/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/apps/warehouse/dist      ./dist
COPY --from=builder /app/apps/warehouse/prisma    ./prisma
COPY apps/warehouse/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 4018
ENTRYPOINT ["./entrypoint.sh"]
