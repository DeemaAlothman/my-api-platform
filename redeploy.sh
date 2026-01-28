#!/bin/bash

# ==========================================
# 🚀 My API Platform - Safe Redeployment Script
# ==========================================

echo "🛑 الخطوة 1: إيقاف الخدمات القديمة وتنظيف البيانات..."

# إيقاف pgadmin بالقوة إذا كان يعمل ويحجز الشبكة
if [ "$(docker ps -q -f name=myapiplatform-pgadmin)" ]; then
    echo "   - Killing lingering pgadmin container..."
    docker rm -f myapiplatform-pgadmin
fi

# إيقاف الخدمات وحذف الـ volumes
docker-compose -f docker-compose.prod.yml down -v

echo "⬇️ الخطوة 2: سحب آخر التحديثات..."
git pull origin main

echo "🏗️ الخطوة 3: بناء وتشغيل الحاويات..."
docker-compose -f docker-compose.prod.yml up -d --build

echo "⏳ جاري انتظار الخدمات لتعمل (30 ثانية)..."
sleep 30

echo "🗄️ الخطوة 4: تهيئة قواعد البيانات (Migrations)..."

# 1. Users Service (Must run first to create 'users' table)
echo "   - Migrating Users..."
docker exec myapiplatform-users npx prisma migrate deploy

# 2. Auth Service (Depends on 'users' table)
echo "   - Migrating Auth..."
docker exec myapiplatform-auth npx prisma migrate deploy

# 3. Leave Service (لا يوجد ملفات migration، نستخدم db push)
echo "   - Pushing Leave Schema..."
docker exec myapiplatform-leave npx prisma db push

# 4. Evaluation Service
echo "   - Migrating Evaluation..."
docker exec myapiplatform-evaluation npx prisma migrate deploy

# 5. Attendance Service
echo "   - Migrating Attendance..."
docker exec myapiplatform-attendance npx prisma migrate deploy

echo "🌱 الخطوة 5: زراعة البيانات (Seeding)..."

echo "   - Seeding Users (Admin & UUID Permissions)..."
docker exec myapiplatform-users npm run prisma:seed

echo "   - Seeding Auth..."
docker exec myapiplatform-auth npm run prisma:seed

echo "   - Seeding Leave..."
docker exec myapiplatform-leave npm run prisma:seed

echo "   - Seeding Evaluation..."
docker exec myapiplatform-evaluation npm run prisma:seed

echo "   - Seeding Attendance..."
docker exec myapiplatform-attendance npm run prisma:seed

echo "✨ ملاحظة هامة:"
echo "   تم تخطي ملف SQL القديم (add-evaluation-permissions-production.sql)"
echo "   لضمان أن تكون جميع الصلاحيات بنظام UUID الموحد."

echo "✅✅✅ تم الانتهاء بنجاح! المشروع يعمل الآن ببيانات نظيفة وموحدة."
