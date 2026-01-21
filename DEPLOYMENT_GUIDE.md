# دليل النشر على السيرفر - Leave Service

## 📋 ملخص التغييرات

### المشكلة التي تم حلها:
- كان النظام يستخدم `userId` من JWT مباشرةً كـ `employeeId`
- لكن البيانات الحقيقية تحتاج `employeeId` من جدول `users.employees`
- هذا كان يسبب خطأ "Leave balance not found" عند الموافقة على الإجازات

### الحل المطبق:
1. **EmployeeInterceptor**: يحول `userId` إلى `employeeId` تلقائياً في كل request
2. **Employee Decorators**: `@EmployeeId()` و `@UserId()` للوصول المباشر
3. **Database Migration**: تصحيح البيانات الموجودة في قاعدة البيانات
4. **Controllers Update**: تحديث جميع controllers لاستخدام النظام الجديد

---

## 🚀 خطوات النشر على السيرفر

### المرحلة 1: التحضير (على جهازك المحلي)

#### 1.1 التأكد من اكتمال التغييرات
```bash
# التأكد من أن كل التعديلات موجودة
cd /c/Users/user/Desktop/wso/my-api-platform

# عرض الملفات المعدلة
git status
```

**الملفات المعدلة:**
- ✅ `apps/leave/src/common/decorators/employee.decorator.ts` (جديد)
- ✅ `apps/leave/src/common/interceptors/employee.interceptor.ts` (جديد)
- ✅ `apps/leave/src/leave-requests/leave-requests.controller.ts` (معدل)
- ✅ `apps/leave/src/leave-balances/leave-balances.controller.ts` (معدل)
- ✅ `apps/leave/src/holidays/holidays.service.ts` (معدل - auto-extract year)
- ✅ `apps/leave/prisma/migrations/fix_employee_ids.sql` (جديد)
- ✅ `apps/auth/src/auth/auth.service.ts` (معدل - leave permissions)

#### 1.2 البناء والتأكد من عدم وجود أخطاء
```bash
# بناء Leave Service
cd apps/leave
npm run build

# بناء Auth Service (إذا تم تعديله)
cd ../auth
npm run build

# بناء Gateway (إذا لزم الأمر)
cd ../gateway
npm run build
```

#### 1.3 حفظ التغييرات في Git
```bash
cd /c/Users/user/Desktop/wso/my-api-platform

# إضافة جميع الملفات المعدلة
git add .

# إنشاء commit
git commit -m "fix: implement proper employee ID mapping in Leave Service

- Add EmployeeInterceptor to auto-resolve employeeId from userId
- Add @EmployeeId() and @UserId() decorators
- Update all Leave controllers to use new decorators
- Add database migration to fix existing leave_requests
- Fix holidays service to auto-extract year from date
- Add leave permissions to auth service hardcoded list

This fixes the 'Leave balance not found' error and ensures
proper employee ID usage across the Leave Service."

# رفع التغييرات إلى GitHub
git push origin main
```

---

### المرحلة 2: النشر على السيرفر

#### السيناريو A: إذا كان السيرفر يستخدم Docker (موصى به)

##### 2.1 الاتصال بالسيرفر
```bash
ssh user@your-server-ip
```

##### 2.2 سحب التحديثات من GitHub
```bash
cd /path/to/my-api-platform

# سحب آخر التحديثات
git pull origin main
```

##### 2.3 تنفيذ Database Migration
```bash
# تنفيذ migration لتصحيح البيانات الموجودة
docker compose exec postgres psql -U postgres -d platform -f /path/to/migrations/fix_employee_ids.sql

# أو يدوياً
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

##### 2.4 إعادة بناء ونشر Services

**الطريقة الأسرع (بدون rebuild كامل):**
```bash
# بناء محلي على السيرفر
cd apps/leave
npm install
npm run build

# نسخ الملفات المبنية إلى Container
docker cp dist myapiplatform-leave:/app/

# إعادة تشغيل Leave Service
docker compose restart leave

# مراقبة logs للتأكد
docker compose logs -f leave
```

**الطريقة الكاملة (rebuild):**
```bash
# إعادة بناء Leave Service
docker compose build leave

# إعادة تشغيل الخدمة
docker compose up -d leave

# مراقبة logs
docker compose logs -f leave
```

##### 2.5 تحديث Auth Service (إذا لزم)
```bash
# بناء Auth Service
cd apps/auth
npm install
npm run build

# نسخ إلى Container
docker cp dist myapiplatform-auth:/app/

# إعادة تشغيل
docker compose restart auth
```

---

#### السيناريو B: إذا كان السيرفر يستخدم PM2 أو Node مباشرة

##### 2.1 سحب التحديثات
```bash
ssh user@your-server-ip
cd /path/to/my-api-platform
git pull origin main
```

##### 2.2 تنفيذ Database Migration
```bash
psql -U postgres -d platform << 'EOF'
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

##### 2.3 تحديث Dependencies وإعادة البناء
```bash
# Leave Service
cd apps/leave
npm install
npm run build

# Auth Service
cd ../auth
npm install
npm run build

# Gateway
cd ../gateway
npm install
npm run build
```

##### 2.4 إعادة تشغيل Services
```bash
# باستخدام PM2
pm2 restart leave-service
pm2 restart auth-service
pm2 restart gateway-service

# أو مباشرة
# (حسب setup السيرفر)
```

---

### المرحلة 3: التحقق من النشر

#### 3.1 التحقق من أن Services تعمل
```bash
# التحقق من Leave Service
curl http://localhost:4003/health

# التحقق من Auth Service
curl http://localhost:4001/health

# التحقق من Gateway
curl http://localhost:8000/health
```

#### 3.2 اختبار Employee ID Mapping
```bash
# تسجيل دخول
curl -X POST http://your-server-ip:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123"}'

# احفظ token من الرد

# اختبار الحصول على رصيد الموظف
curl http://your-server-ip:8000/api/v1/leave-balances/my?year=2024 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# يجب أن ترى الرصيد بدون أخطاء
```

#### 3.3 اختبار سير العمل الكامل
```bash
# 1. إنشاء طلب إجازة
curl -X POST http://your-server-ip:8000/api/v1/leave-requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leaveTypeId": "LEAVE_TYPE_ID",
    "startDate": "2024-02-15",
    "endDate": "2024-02-17",
    "reason": "اختبار النظام",
    "isHalfDay": false
  }'

# 2. تقديم الطلب
curl -X POST http://your-server-ip:8000/api/v1/leave-requests/REQUEST_ID/submit \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. موافقة المدير
curl -X POST http://your-server-ip:8000/api/v1/leave-requests/REQUEST_ID/approve-manager \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "موافقة المدير"}'

# 4. موافقة HR (يجب أن تعمل بدون خطأ!)
curl -X POST http://your-server-ip:8000/api/v1/leave-requests/REQUEST_ID/approve-hr \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "موافقة HR"}'

# 5. التحقق من خصم الرصيد
curl http://your-server-ip:8000/api/v1/leave-balances/my?year=2024 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚠️ الأخطاء المحتملة وحلولها

### خطأ: "Employee record not found"
**السبب**: المستخدم لا يملك سجل موظف في جدول `users.employees`

**الحل:**
```sql
-- إنشاء سجل موظف للمستخدم
INSERT INTO users.employees (
  id, "employeeNumber", "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn",
  email, gender, "departmentId", "userId", "hireDate", "contractType",
  "employmentStatus", "createdAt", "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'EMP_NUMBER',
  'الاسم الأول',
  'الاسم الأخير',
  'First Name',
  'Last Name',
  'user@email.com',
  'MALE',
  'DEPARTMENT_ID',
  'USER_ID_FROM_JWT',
  NOW(),
  'PERMANENT',
  'ACTIVE',
  NOW(),
  NOW()
);
```

### خطأ: "Leave balance not found" بعد النشر
**السبب**: لم يتم تنفيذ migration script

**الحل:**
```bash
# تنفيذ migration يدوياً
docker compose exec postgres psql -U postgres -d platform << 'EOF'
UPDATE leaves.leave_requests lr
SET "employeeId" = e.id
FROM users.employees e
WHERE lr."employeeId" = e."userId"::text;
EOF
```

### خطأ: Module not found بعد النشر
**السبب**: Dependencies لم يتم تثبيتها

**الحل:**
```bash
cd apps/leave
npm install
npm run build
docker compose restart leave
```

---

## 📊 ملخص التحسينات

### ✅ ما تم إصلاحه:
1. **Employee ID Mapping** - تحويل تلقائي من userId إلى employeeId
2. **Leave Balance Access** - الآن يعمل بشكل صحيح مع employee records
3. **Approval Workflow** - موافقة المدير و HR تعمل بدون أخطاء
4. **Holiday Creation** - auto-extract year from date
5. **Code Maintainability** - استخدام decorators و interceptors قياسية

### 🚀 الفوائد للمستقبل:
- ✅ قابل للتوسع - سهل إضافة موظفين جدد
- ✅ واضح ومفهوم - الكود self-documenting
- ✅ آمن - التحقق من وجود employee record تلقائياً
- ✅ maintainable - سهل التعديل والصيانة

---

## 🔒 التحقق الأمني

### قبل النشر على Production:
1. ✅ التأكد من صحة database backup
2. ✅ اختبار جميع endpoints في staging environment
3. ✅ التحقق من صلاحيات المستخدمين
4. ✅ مراجعة logs للتأكد من عدم وجود أخطاء
5. ✅ التأكد من أن جميع المستخدمين لديهم employee records

---

## 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من Docker logs: `docker compose logs -f leave`
2. تحقق من Database: الاستعلامات في القسم السابق
3. تحقق من Git: `git log -n 5` لرؤية آخر commits

---

## 📝 Rollback Plan (خطة الرجوع)

إذا حدثت مشاكل بعد النشر:

```bash
# 1. الرجوع إلى الإصدار السابق
git log  # لمعرفة commit hash السابق
git revert COMMIT_HASH

# 2. إعادة البناء
cd apps/leave && npm run build

# 3. إعادة النشر
docker compose restart leave

# 4. أو rollback قاعدة البيانات (إذا لزم الأمر)
# استخدام backup قبل النشر
```

---

**ملاحظة نهائية:** هذا النظام جاهز للإنتاج ويعمل بشكل صحيح. تم اختباره محلياً وجميع endpoints تعمل بنجاح. 🎉
