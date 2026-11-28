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

# تُنصَّب تبعياتُ هذه الخدمة من بيانها هي، ولا تُنسَخ شجرةُ الجذر من مرحلة البناء.
# فالجذرُ يُعرِّف مساحةَ عملٍ أعضاؤها كلُّ التطبيقات، ولا يُنسَخ إلى البناء إلا
# بيانُ هذه الخدمة — فتخرج الشجرةُ ناقصةً من حزمةٍ تُعلِنها الخدمةُ وتَلزمها،
# فتقلع فلا تجدها. وكان الكاشُ يُخفي ذلك حتى أُفرِغ، فانهارت خدمةُ المستودع.
# وعميلُ Prisma يُنسَخ مولَّداً من البناء ولا يُعاد توليدُه هنا، كما في zkteco:
# التوليدُ في مرحلة الإنتاج يَجلب المُشغِّلَ من الشبكة فيُفاجئ بنسخةٍ أحدث.
COPY --from=builder /app/apps/clinical-prosthetics/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/apps/clinical-prosthetics/dist   ./dist
COPY --from=builder /app/apps/clinical-prosthetics/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4011
CMD ["node", "dist/apps/clinical-prosthetics/src/main.js"]
