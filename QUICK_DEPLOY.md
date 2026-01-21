# 🚀 دليل النشر السريع - Leave Service

## على السيرفر مباشرة

### 1️⃣ سحب التحديثات من GitHub
```bash
cd /path/to/my-api-platform
git pull origin main
```

### 2️⃣ إضافة Leave Permissions إلى Database
```bash
docker compose exec postgres psql -U postgres -d platform < add-leave-permissions.sql
```

**أو يدوياً:**
```bash
cat add-leave-permissions.sql | docker compose exec -T postgres psql -U postgres -d platform
```

**التحقق من إضافة Permissions:**
```bash
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT COUNT(*) FROM users.permissions WHERE module = 'leaves';"
```
يجب أن ترى: **24 permission**

### 3️⃣ تنفيذ Database Migration (تصحيح البيانات الموجودة)
```bash
docker compose exec postgres psql -U postgres -d platform << 'EOF'
UPDATE leaves.leave_requests lr
SET "employeeId" = e.id
FROM users.employees e
WHERE lr."employeeId" = e."userId"::text
  AND EXISTS (
    SELECT 1 FROM users.employees
    WHERE "userId" = lr."employeeId"
  );
EOF
```

### 3️⃣ تنفيذ Prisma Migrations (إنشاء الجداول)
```bash
docker compose exec leave npx prisma migrate deploy
```

### 4️⃣ تنفيذ Seed (إضافة البيانات الأولية)
```bash
docker compose exec leave npx tsx prisma/seed.ts
```

### 5️⃣ إعادة بناء ونشر Leave Service

**الطريقة الأسرع:**
```bash
cd apps/leave
npm install
npm run build
docker cp dist myapiplatform-leave:/app/
docker compose restart leave
```

**أو الطريقة الكاملة:**
```bash
docker compose build leave
docker compose up -d leave
```

### 6️⃣ إعادة بناء Auth Service (إذا لزم)
```bash
cd apps/auth
npm install
npm run build
docker cp dist myapiplatform-auth:/app/
docker compose restart auth
```

### 7️⃣ مراقبة Logs
```bash
docker compose logs -f leave
docker compose logs -f auth
```

---

## 🧪 الاختبار السريع

### 1. تسجيل الدخول
```bash
curl -X POST http://your-server:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```
احفظ الـ `accessToken` من الرد.

### 2. التحقق من الرصيد
```bash
curl http://your-server:8000/api/v1/leave-balances/my?year=2024 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. إنشاء طلب إجازة
```bash
curl -X POST http://your-server:8000/api/v1/leave-requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leaveTypeId": "9ab1050f-cc3f-4d35-a065-15b60132d0df",
    "startDate": "2024-02-15",
    "endDate": "2024-02-17",
    "reason": "اختبار",
    "isHalfDay": false
  }'
```
احفظ الـ `id` من الرد.

### 4. تقديم الطلب
```bash
curl -X POST http://your-server:8000/api/v1/leave-requests/REQUEST_ID/submit \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. موافقة المدير
```bash
curl -X POST http://your-server:8000/api/v1/leave-requests/REQUEST_ID/approve-manager \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"موافقة"}'
```

### 6. موافقة HR (الاختبار الحاسم!)
```bash
curl -X POST http://your-server:8000/api/v1/leave-requests/REQUEST_ID/approve-hr \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"موافقة نهائية"}'
```

✅ **إذا نجح هذا الطلب، يعني كل شي تمام!**

### 7. التحقق من خصم الرصيد
```bash
curl http://your-server:8000/api/v1/leave-balances/my?year=2024 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

يجب أن ترى `usedDays: 3` و `remainingDays: 18`

---

## 📋 Checklist

قبل النشر:
- [ ] Docker Desktop شغال
- [ ] Git pull نجح
- [ ] Backup للـ database موجود

أثناء النشر:
- [ ] Database migration نجح
- [ ] Prisma migrations نجحت
- [ ] Seed نجح
- [ ] Build نجح
- [ ] Services تم إعادة تشغيلها

بعد النشر:
- [ ] Login يعمل
- [ ] Get balance يعمل
- [ ] Create request يعمل
- [ ] Submit request يعمل
- [ ] Approve manager يعمل
- [ ] Approve HR يعمل ✅ (أهم اختبار!)
- [ ] Balance deduction صحيح

---

## 🔍 التحقق من البيانات

### التحقق من أنواع الإجازات
```bash
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT code, \"nameAr\", \"defaultDays\" FROM leaves.leave_types LIMIT 5;"
```

### التحقق من Employee Records
```bash
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT id, \"employeeNumber\", \"firstNameAr\", \"userId\" FROM users.employees LIMIT 5;"
```

### التحقق من Leave Balances
```bash
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT \"employeeId\", \"totalDays\", \"usedDays\", \"remainingDays\"
   FROM leaves.leave_balances LIMIT 5;"
```

### التحقق من Leave Requests
```bash
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT id, \"employeeId\", status, \"totalDays\"
   FROM leaves.leave_requests ORDER BY \"createdAt\" DESC LIMIT 5;"
```

---

## ⚠️ حل المشاكل السريع

### "Employee record not found"
```sql
-- أنشئ employee record
docker compose exec postgres psql -U postgres -d platform << 'EOF'
INSERT INTO users.employees (
  id, "employeeNumber", "firstNameAr", "lastNameAr", "email",
  gender, "departmentId", "userId", "hireDate", "contractType",
  "employmentStatus", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), 'EMP_XXX', 'الاسم', 'العائلة', 'email@domain.com',
  'MALE', 'DEPT_ID', 'USER_ID', NOW(), 'PERMANENT',
  'ACTIVE', NOW(), NOW()
);
EOF
```

### "Leave balance not found"
```bash
# تأكد من تنفيذ migration
docker compose exec postgres psql -U postgres -d platform << 'EOF'
UPDATE leaves.leave_requests lr
SET "employeeId" = e.id
FROM users.employees e
WHERE lr."employeeId" = e."userId"::text;
EOF
```

### "Module not found" أو Build Errors
```bash
cd apps/leave
rm -rf node_modules dist
npm install
npm run build
docker cp dist myapiplatform-leave:/app/
docker compose restart leave
```

---

## 🎯 النتيجة المتوقعة

بعد النشر الناجح:
- ✅ جميع endpoints تعمل
- ✅ Employee ID mapping يعمل تلقائياً
- ✅ Leave balances تظهر بشكل صحيح
- ✅ Approval workflow يعمل بالكامل
- ✅ Balance deduction يعمل
- ✅ Logs نظيفة بدون errors

---

**وقت النشر المتوقع:** 10-15 دقيقة

**صعوبة:** متوسطة

**المخاطر:** منخفضة (backward compatible)
