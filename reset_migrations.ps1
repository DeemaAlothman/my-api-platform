# ==========================================
# 🔄 My API Platform - Migration Reset Script (Windows)
# ==========================================
# تحذير: هذا السكربت سيقوم بحذف قاعدة البيانات بالكامل وإعادة تكوينها

Write-Host "⚠️  تحذير: سيتم حذف جميع البيانات وملفات الـ Migration القديمة!" -ForegroundColor Yellow
$confirmation = Read-Host "هل أنت متأكد أنك تريد المتابعة؟ (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "❌ تم إلغاء العملية." -ForegroundColor Red
    exit
}

Write-Host "🛑 1. إيقاف الخدمات وحذف البيانات..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml down -v

Write-Host "🧹 2. حذف ملفات Migration القديمة..." -ForegroundColor Cyan
Remove-Item -Path "apps\users\prisma\migrations" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "apps\auth\prisma\migrations" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "apps\attendance\prisma\migrations" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "apps\evaluation\prisma\migrations" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "🏗️ 3. تشغيل قاعدة البيانات..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml up -d postgres
Start-Sleep -Seconds 10

Write-Host "🆕 4. إعادة توليد ملفات Migration (Squashing)..." -ForegroundColor Cyan

# تشغيل الحاويات الخلفية لتمكين تنفيذ الأوامر
docker-compose -f docker-compose.prod.yml up -d
Write-Host "⏳ انتظار الخدمات (20 ثانية)..." -ForegroundColor Cyan
Start-Sleep -Seconds 20

# Users
Write-Host "   - Resetting Users DB & Migration..." -ForegroundColor Green
docker exec myapiplatform-users npx prisma migrate dev --name init_structure

# Auth
Write-Host "   - Resetting Auth DB & Migration..." -ForegroundColor Green
docker exec myapiplatform-auth npx prisma migrate dev --name init_structure

# Attendance
Write-Host "   - Resetting Attendance DB & Migration..." -ForegroundColor Green
docker exec myapiplatform-attendance npx prisma migrate dev --name init_structure

# Evaluation
Write-Host "   - Resetting Evaluation DB & Migration..." -ForegroundColor Green
docker exec myapiplatform-evaluation npx prisma migrate dev --name init_structure

# Leave
Write-Host "   - Pushing Leave DB schema..." -ForegroundColor Green
docker exec myapiplatform-leave npx prisma db push

Write-Host "🌱 5. زراعة البيانات (Seeding)..." -ForegroundColor Cyan
docker exec myapiplatform-users npm run prisma:seed
docker exec myapiplatform-auth npm run prisma:seed
docker exec myapiplatform-attendance npm run prisma:seed
docker exec myapiplatform-evaluation npm run prisma:seed
docker exec myapiplatform-leave npm run prisma:seed

Write-Host "✅✅✅ تم الانتهاء! مشروعك الآن نظيف تماماً." -ForegroundColor Green
