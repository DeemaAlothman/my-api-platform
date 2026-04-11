#!/bin/bash
# تشغيل البيانات التجريبية فقط (بعد seed-all.sh)
echo "✨ Starting demo data seed..."

run_seed() {
  local service=$1
  echo ""
  docker compose exec -T "$service" sh -c \
    "[ -f node_modules/.bin/tsx ] || npm install tsx --no-save -q 2>/dev/null; node_modules/.bin/tsx prisma/seed-demo.ts"
}

echo ""
echo "=== Demo 1/6 Users Service ==="
run_seed users

echo ""
echo "=== Demo 2/6 Leave Service ==="
run_seed leave

echo ""
echo "=== Demo 3/6 Attendance Service ==="
run_seed attendance

echo ""
echo "=== Demo 4/6 Evaluation Service ==="
run_seed evaluation

echo ""
echo "=== Demo 5/6 Jobs Service ==="
run_seed jobs

echo ""
echo "=== Demo 6/6 ZKTeco Service ==="
run_seed zkteco

echo ""
echo "🎉 Demo seed completed!"
echo ""
echo "📋 Demo login credentials (password: Demo@123456):"
echo "   sarah.hr   → مديرة الموارد البشرية"
echo "   khalid.it  → مدير IT (مسؤول عن فاطمة وعمر)"
echo "   fatima.dev → مطورة"
echo "   omar.dev   → مطور"
echo "   nora.fin   → محاسبة"
