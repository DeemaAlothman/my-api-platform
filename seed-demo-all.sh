#!/bin/bash
# تشغيل البيانات التجريبية فقط (بعد seed-all.sh)
echo "✨ Starting demo data seed..."

echo ""
echo "=== Demo 1/5 Users Service (5 employees + hierarchy) ==="
docker compose exec users npx tsx prisma/seed-demo.ts

echo ""
echo "=== Demo 2/5 Leave Service (balances + requests) ==="
docker compose exec leave npx tsx prisma/seed-demo.ts

echo ""
echo "=== Demo 3/5 Attendance Service (work schedule + records) ==="
docker compose exec attendance npx tsx prisma/seed-demo.ts

echo ""
echo "=== Demo 4/5 Evaluation Service (forms + sections) ==="
docker compose exec evaluation npx tsx prisma/seed-demo.ts

echo ""
echo "=== Demo 5/6 Jobs Service (positions + evaluations) ==="
docker compose exec jobs npx tsx prisma/seed-demo.ts

echo ""
echo "=== Demo 6/6 ZKTeco Service (biometric device + fingerprints) ==="
docker compose exec zkteco npx tsx prisma/seed-demo.ts

echo ""
echo "🎉 Demo seed completed!"
echo ""
echo "📋 Demo login credentials (password: Demo@123456):"
echo "   sarah.hr   → مديرة الموارد البشرية"
echo "   khalid.it  → مدير IT (مسؤول عن فاطمة وعمر)"
echo "   fatima.dev → مطورة"
echo "   omar.dev   → مطور"
echo "   nora.fin   → محاسبة"
