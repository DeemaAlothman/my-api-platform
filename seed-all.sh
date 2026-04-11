#!/bin/bash
# تشغيل جميع seeds للمشروع
echo "🌱 Starting full seed..."

echo ""
echo "=== 1/5 Users Service (permissions, roles, admin user, departments, job titles) ==="
docker compose exec users npx tsx prisma/seed.ts

echo ""
echo "=== 2/5 Leave Service (leave types, holidays) ==="
docker compose exec leave npx tsx prisma/seed.ts

echo ""
echo "=== 3/5 Evaluation Service (evaluation criteria) ==="
docker compose exec evaluation npx tsx prisma/seed.ts

echo ""
echo "=== 4/5 Attendance Service ==="
docker compose exec attendance npx tsx prisma/seed.ts

echo ""
echo "=== 5/5 Jobs Service (personal criteria, computer criteria) ==="
docker compose exec jobs npx tsx prisma/seed.ts

echo ""
echo "🎉 All seeds completed!"
