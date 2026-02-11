#!/bin/bash

# ==========================================
# 🔄 My API Platform - Migration Reset Script
# ==========================================
# تحذير: هذا السكربت سيقوم بحذف قاعدة البيانات بالكامل وإعادة تكوينها
# الهدف: تنظيف ملفات الـ Migration القديمة وجعل المشروع "نظامي"

echo "⚠️  تحذير: سيتم حذف جميع البيانات وملفات الـ Migration القديمة!"
read -p "هل أنت متأكد أنك تريد المتابعة؟ (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ تم إلغاء العملية."
    exit 1
fi

echo "🛑 1. إيقاف الخدمات وحذف البيانات..."
docker-compose -f docker-compose.prod.yml down -v

echo "🧹 2. حذف ملفات Migration القديمة..."
# حذف جميع مجلدات migrations ما عدا ملفات الـ SQL اليدوية إذا وجدت (نحن نحذف المجلد بالكامل لأنه سيعاد توليده)
rm -rf apps/users/prisma/migrations
rm -rf apps/auth/prisma/migrations
rm -rf apps/attendance/prisma/migrations
rm -rf apps/evaluation/prisma/migrations
# leave service ليس لديه migrations أصلاً، لذا لا داعي لحذفه

echo "🏗️ 3. تشغيل قاعدة البيانات فقط..."
docker-compose -f docker-compose.prod.yml up -d postgres
echo "⏳ انتظار قاعدة البيانات (10 ثواني)..."
sleep 10

echo "🆕 4. إعادة توليد ملفات Migration (Squashing)..."
# نستخدم حاويات مؤقتة لتوليد ملفات الـ migration الجديدة

# Users Service
echo "   - Generating Users Migration..."
# ملاحظة: نستخدم docker run لإنشاء الملفات، لكن نحتاج أن يكون المجلد مرتبطاً
# الطريقة الأسهل هنا هي تشغيل الخدمات ثم تنفيذ الأمر داخلها، لكن الخدمات ستفشل في البدء لأن الجداول غير موجودة
# لذا سنشغل الخدمات في الخلفية، ستعمل إعادة تشغيل (restart loop) وهذا لا بأس به، سننفذ الأمر بسرعة

docker-compose -f docker-compose.prod.yml up -d

echo "⏳ انتظار الخدمات (20 ثانية)..."
sleep 20

# Users
echo "   - Resetting Users DB & Migration..."
docker exec myapiplatform-users npx prisma migrate dev --name init_structure

# Auth
echo "   - Resetting Auth DB & Migration..."
docker exec myapiplatform-auth npx prisma migrate dev --name init_structure

# Attendance
echo "   - Resetting Attendance DB & Migration..."
docker exec myapiplatform-attendance npx prisma migrate dev --name init_structure

# Evaluation
echo "   - Resetting Evaluation DB & Migration..."
docker exec myapiplatform-evaluation npx prisma migrate dev --name init_structure

# Leave (Just db push)
echo "   - Pushing Leave DB schema..."
docker exec myapiplatform-leave npx prisma db push

echo "🌱 5. زراعة البيانات (Seeding)..."
docker exec myapiplatform-users npm run prisma:seed
docker exec myapiplatform-auth npm run prisma:seed
docker exec myapiplatform-attendance npm run prisma:seed
docker exec myapiplatform-evaluation npm run prisma:seed
docker exec myapiplatform-leave npm run prisma:seed

echo "✅✅✅ تم الانتهاء! مشروعك الآن نظيف تماماً وتم دمج التهجيرات."
