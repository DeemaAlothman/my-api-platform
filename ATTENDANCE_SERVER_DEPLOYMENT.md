# 🚀 تعليمات رفع Attendance Service على السيرفر

## ⚠️ **تنبيه مهم جداً**
هذه التعليمات تضمن لك رفع الخدمة **بدون أي أخطاء** مثل التي حدثت في Leave Service.

---

## 📦 الملفات التي سيتم رفعها

### ✅ الملفات الرئيسية (جديدة):
```
apps/attendance/                          # المجلد الكامل للخدمة
├── Dockerfile                            # ملف البناء
├── package.json                          # التبعيات
├── tsconfig.json                         # إعدادات TypeScript
├── nest-cli.json                         # إعدادات NestJS
├── prisma/
│   ├── schema.prisma                     # قاعدة البيانات
│   ├── seed.ts                           # البيانات الأولية
│   └── migrations/
│       └── 20260124000000_init_attendance/
│           └── migration.sql             # Migration يدوي
└── src/                                  # الكود المصدري الكامل
```

### ✅ الملفات المعدلة:
```
apps/auth/src/auth/auth.service.ts        # ⭐ الأهم: إضافة 17 permission
apps/users/prisma/seed.ts                 # إضافة 22 permission
apps/gateway/src/proxy/proxy.controller.ts # إضافة 3 controllers
apps/gateway/src/proxy/proxy.service.ts    # إضافة attendance service URL
apps/gateway/src/proxy/proxy.module.ts     # استيراد controllers
docker-compose.prod.yml                    # إضافة attendance service
docker-compose.yml                         # للاختبار المحلي
```

---

## 📝 المرحلة الأولى: التحضير والتحقق

### 1️⃣ التحقق من الملفات الحرجة

```bash
# على جهازك المحلي
cd c:\Users\user\Desktop\wso\my-api-platform

# تحقق من وجود الملف الأهم (permissions في Auth Service)
type apps\auth\src\auth\auth.service.ts | findstr "attendance"
```

**✅ يجب أن ترى:**
```typescript
'attendance.work-schedules.read',
'attendance.work-schedules.create',
// ... و 15 permission أخرى
```

**❌ إذا لم تر هذه الأسطر، لا ترفع على السيرفر!**

---

### 2️⃣ التحقق من Docker Compose Production

```bash
type docker-compose.prod.yml | findstr "attendance"
```

**✅ يجب أن ترى:**
```yaml
attendance:
  build:
    context: .
    dockerfile: apps/attendance/Dockerfile
  container_name: myapiplatform-attendance
  ...
ATTENDANCE_SERVICE_URL: http://attendance:4004
```

---

## 🔐 المرحلة الثانية: Git Commit & Push

### 1️⃣ إضافة جميع الملفات

```bash
# إضافة المجلد الكامل
git add apps/attendance/

# إضافة الملفات المعدلة
git add apps/auth/src/auth/auth.service.ts
git add apps/users/prisma/seed.ts
git add apps/gateway/src/proxy/proxy.controller.ts
git add apps/gateway/src/proxy/proxy.service.ts
git add apps/gateway/src/proxy/proxy.module.ts
git add docker-compose.prod.yml
git add docker-compose.yml

# إضافة ملفات التوثيق (اختياري)
git add ATTENDANCE_DEPLOYMENT_GUIDE.md
git add ATTENDANCE_ENDPOINTS_GUIDE.md
git add attendance-service.postman_collection.json
```

### 2️⃣ إنشاء Commit

```bash
git commit -m "feat: Add Attendance Service on port 4004

- Created complete attendance service with 6 Prisma models
- Added 3 work schedules (Standard, Flexible, Shifts)
- Added 22 attendance permissions to Users service seed
- CRITICAL FIX: Added 17 attendance permissions to Auth service hardcoded array
- Updated Gateway to route attendance endpoints
- Added to docker-compose.prod.yml for production deployment
- All endpoints tested and working on local

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 3️⃣ Push إلى Repository

```bash
git push origin main
```

**⚠️ انتظر حتى ينتهي الـ push بنجاح قبل الانتقال للخطوة التالية!**

---

## 🖥️ المرحلة الثالثة: الرفع على السيرفر

### 1️⃣ الاتصال بالسيرفر

```bash
ssh your-username@your-server-ip
```

### 2️⃣ الانتقال إلى مجلد المشروع

```bash
cd /path/to/my-api-platform
# أو المسار الذي فيه المشروع على السيرفر
```

### 3️⃣ Pull آخر التحديثات

```bash
# حفظ التغييرات المحلية إن وجدت
git stash

# سحب آخر التحديثات
git pull origin main

# إرجاع التغييرات المحلية إن كانت موجودة
git stash pop
```

**✅ يجب أن ترى:**
```
From github.com:your-repo/my-api-platform
 * branch            main       -> FETCH_HEAD
Updating xxxxx..yyyyy
Fast-forward
 apps/attendance/...
 apps/auth/src/auth/auth.service.ts | 17 ++++
 ...
 X files changed, YYY insertions(+), ZZZ deletions(-)
```

### 4️⃣ التحقق من وصول الملفات

```bash
# تحقق من وجود مجلد attendance
ls -la apps/attendance/

# تحقق من الملف الحرج (permissions)
grep -n "attendance.work-schedules" apps/auth/src/auth/auth.service.ts
```

**✅ يجب أن ترى أرقام أسطر فيها permissions الحضور**

---

## 🐳 المرحلة الرابعة: بناء ونشر الخدمات

### 1️⃣ إيقاف الخدمات الحالية

```bash
docker-compose -f docker-compose.prod.yml down
```

**⚠️ ملاحظة:** هذا سيوقف جميع الخدمات مؤقتاً (2-3 دقائق)

### 2️⃣ بناء جميع الخدمات (بما فيها attendance)

```bash
docker-compose -f docker-compose.prod.yml build
```

**⏳ هذه الخطوة ستأخذ وقت (10-15 دقيقة):**
- Auth Service
- Users Service
- Leave Service
- **Attendance Service** ← الجديد
- Gateway

**✅ يجب أن ترى في النهاية:**
```
Successfully built xxxxxxxx
Successfully tagged my-api-platform-attendance:latest
```

### 3️⃣ تشغيل الخدمات

```bash
docker-compose -f docker-compose.prod.yml up -d
```

**✅ يجب أن ترى:**
```
Creating myapiplatform-postgres ... done
Creating myapiplatform-auth ... done
Creating myapiplatform-users ... done
Creating myapiplatform-leave ... done
Creating myapiplatform-attendance ... done
Creating myapiplatform-gateway ... done
```

### 4️⃣ التحقق من تشغيل الخدمات

```bash
docker-compose -f docker-compose.prod.yml ps
```

**✅ يجب أن ترى جميع الخدمات "Up":**
```
NAME                        STATUS
myapiplatform-attendance    Up
myapiplatform-auth          Up
myapiplatform-gateway       Up
myapiplatform-leave         Up
myapiplatform-postgres      Up (healthy)
myapiplatform-users         Up
```

---

## 🗄️ المرحلة الخامسة: قاعدة البيانات (Migration & Seed)

### 1️⃣ تنفيذ Migration

```bash
# الدخول إلى حاوية Attendance
docker exec -it myapiplatform-attendance sh

# داخل الحاوية
npx prisma migrate deploy

# الخروج من الحاوية
exit
```

**✅ يجب أن ترى:**
```
The following migration(s) have been applied:

migrations/
  └─ 20260124000000_init_attendance/
    └─ migration.sql

All migrations have been successfully applied.
```

**❌ إذا رأيت خطأ:**
```bash
# تأكد من أن schema attendance موجود في قاعدة البيانات
docker exec -it myapiplatform-postgres psql -U postgres -d platform -c "CREATE SCHEMA IF NOT EXISTS attendance;"

# ثم أعد المحاولة
docker exec -it myapiplatform-attendance npx prisma migrate deploy
```

### 2️⃣ تنفيذ Seed (البيانات الأولية)

```bash
# الدخول إلى حاوية Attendance
docker exec -it myapiplatform-attendance sh

# داخل الحاوية
npm run seed

# الخروج
exit
```

**✅ يجب أن ترى:**
```
🌱 Seeding attendance database...
✅ Created 3 work schedules
✅ Created 2 custom work schedules (Ramadan)
✅ Created 1 attendance setting
✨ Seed completed successfully!
```

### 3️⃣ تحديث Permissions في Users Service

```bash
# الدخول إلى حاوية Users
docker exec -it myapiplatform-users sh

# داخل الحاوية
npm run seed

# الخروج
exit
```

**✅ يجب أن ترى:**
```
🌱 Seeding users database...
✅ Permissions updated (including 22 attendance permissions)
...
✨ Seed completed successfully!
```

### 4️⃣ إعادة تشغيل Auth Service (مهم جداً!)

```bash
# إعادة تشغيل Auth لتحميل Permissions الجديدة
docker-compose -f docker-compose.prod.yml restart auth

# التحقق من إعادة التشغيل
docker logs myapiplatform-auth --tail 20
```

**✅ يجب أن ترى:**
```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] AppModule dependencies initialized
...
[Nest] LOG [NestApplication] Nest application successfully started
```

---

## ✅ المرحلة السادسة: الاختبار النهائي

### 1️⃣ اختبار Health Check

```bash
# على السيرفر
curl http://localhost:5000/api/v1/auth/health

# من جهازك (استبدل SERVER_IP بـ IP السيرفر)
curl http://SERVER_IP:5000/api/v1/auth/health
```

**✅ النتيجة المتوقعة:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-24T..."
}
```

### 2️⃣ اختبار تسجيل الدخول والـ Permissions

```bash
# Login
curl -X POST http://SERVER_IP:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

**✅ يجب أن ترى في الـ response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "username": "admin",
      "permissions": [
        "users:read",
        "users:create",
        ...
        "attendance.work-schedules.read",       ← موجود
        "attendance.work-schedules.create",     ← موجود
        "attendance.records.check-in",          ← موجود
        "attendance.alerts.read",               ← موجود
        ... (إجمالي 57 permission)
      ]
    },
    "accessToken": "eyJhbGciOiJ...",
    ...
  }
}
```

**❌ إذا كان عدد الـ permissions = 40 فقط (بدون attendance):**
```bash
# تأكد من أن Auth Service تم إعادة تشغيله بعد التحديث
docker-compose -f docker-compose.prod.yml restart auth

# انتظر 10 ثواني ثم جرب Login مرة أخرى
```

### 3️⃣ اختبار Work Schedules Endpoint

```bash
# احفظ الـ TOKEN من Login السابق
TOKEN="eyJhbGciOiJ..."

# اختبار GET /work-schedules
curl http://SERVER_IP:5000/api/v1/work-schedules \
  -H "Authorization: Bearer $TOKEN"
```

**✅ يجب أن ترى:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "code": "WS001",
      "nameEn": "Full Time - Admin Staff",
      "nameAr": "دوام كامل - موظفين إداريين",
      "workStartTime": "09:00",
      "workEndTime": "17:00",
      "workDays": "[0,1,2,3,4]",
      "allowOvertime": true,
      "maxOvertimeHours": 2,
      "isActive": true
    },
    ... (إجمالي 3 work schedules)
  ]
}
```

### 4️⃣ اختبار Clock-In

```bash
curl -X POST http://SERVER_IP:5000/api/v1/attendance-records/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Office - Building A"
  }'
```

**✅ يجب أن ترى:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "employeeId": "...",
    "date": "2026-01-24T00:00:00.000Z",
    "clockInTime": "2026-01-24T08:30:00.000Z",
    "clockInLocation": "Office - Building A",
    "status": "PRESENT",
    ...
  }
}
```

### 5️⃣ اختبار My Attendance

```bash
curl http://SERVER_IP:5000/api/v1/attendance-records/my \
  -H "Authorization: Bearer $TOKEN"
```

**✅ يجب أن ترى قائمة سجلات الحضور للمستخدم الحالي**

---

## 🔍 المرحلة السابعة: مراقبة الـ Logs

### التحقق من Logs جميع الخدمات

```bash
# Attendance Service
docker logs myapiplatform-attendance --tail 50

# Auth Service
docker logs myapiplatform-auth --tail 50

# Gateway
docker logs myapiplatform-gateway --tail 50

# Users Service
docker logs myapiplatform-users --tail 50
```

**✅ يجب ألا ترى أي أخطاء (ERROR) في الـ logs**

---

## ⚠️ استكشاف الأخطاء المحتملة

### Problem 1: Attendance Service لا يعمل

**الأعراض:**
```
Error response from daemon: Container is not running
```

**الحل:**
```bash
# شاهد logs الخدمة
docker logs myapiplatform-attendance

# أعد بناء الخدمة
docker-compose -f docker-compose.prod.yml build attendance

# أعد تشغيلها
docker-compose -f docker-compose.prod.yml up -d attendance
```

### Problem 2: Migration فشل

**الأعراض:**
```
Error: P1001 - Can't reach database server
```

**الحل:**
```bash
# تأكد من أن PostgreSQL يعمل
docker-compose -f docker-compose.prod.yml ps postgres

# تأكد من أن schema موجود
docker exec -it myapiplatform-postgres psql -U postgres -d platform -c "CREATE SCHEMA IF NOT EXISTS attendance;"

# أعد المحاولة
docker exec -it myapiplatform-attendance npx prisma migrate deploy
```

### Problem 3: Permissions غير موجودة (40 بدل 57)

**الأعراض:**
```json
{
  "permissions": [...] // عددها 40 فقط
}
```

**الحل الأكيد:**
```bash
# 1. تأكد من أن auth.service.ts تم تحديثه
docker exec myapiplatform-auth cat /app/dist/auth/auth.service.js | grep "attendance.work-schedules"

# 2. إذا لم يظهر شيء، يعني الملف لم يُبنى بالتحديث
docker-compose -f docker-compose.prod.yml build auth

# 3. أعد تشغيل Auth
docker-compose -f docker-compose.prod.yml up -d auth

# 4. انتظر 10 ثواني ثم جرب Login مرة أخرى
```

### Problem 4: Gateway لا يوجه الطلبات

**الأعراض:**
```json
{
  "code": "SERVICE_UNAVAILABLE",
  "message": "Service attendance is unavailable"
}
```

**الحل:**
```bash
# تحقق من أن Gateway يرى Attendance Service
docker exec myapiplatform-gateway env | grep ATTENDANCE

# يجب أن ترى:
# ATTENDANCE_SERVICE_URL=http://attendance:4004

# إذا لم تره، أعد بناء Gateway
docker-compose -f docker-compose.prod.yml build gateway
docker-compose -f docker-compose.prod.yml up -d gateway
```

---

## ✅ Checklist النهائي

قبل إنهاء العملية، تأكد من:

- [ ] جميع الخدمات تعمل (6 services: postgres, auth, users, leave, attendance, gateway)
- [ ] Migration تم تنفيذه بنجاح
- [ ] Seed تم تنفيذه بنجاح (3 work schedules)
- [ ] Permissions في Users Service تم تحديثها (22 permission)
- [ ] Login يعطي 57 permission (40 قديمة + 17 attendance جديدة)
- [ ] GET /work-schedules يعمل ويعطي 3 schedules
- [ ] POST /attendance-records/clock-in يعمل بنجاح
- [ ] GET /attendance-records/my يعطي سجلات الحضور
- [ ] لا توجد أخطاء في Logs

---

## 📊 نتيجة العملية

بعد اتباع هذه التعليمات، سيكون لديك:

1. ✅ **Attendance Service** يعمل على البورت **4004**
2. ✅ **6 نماذج** في قاعدة البيانات (WorkSchedule, EmployeeSchedule, CustomWorkSchedule, AttendanceRecord, AttendanceAlert, AttendanceSetting)
3. ✅ **3 جداول عمل** افتراضية (Standard, Flexible, Shifts)
4. ✅ **22 permission** جديدة في قاعدة البيانات
5. ✅ **17 permission** في Auth Service (hardcoded)
6. ✅ **Gateway** يوجه طلبات Attendance بنجاح
7. ✅ جميع الـ endpoints تعمل بدون أخطاء

---

## 🎯 الخطوة التالية (اختياري)

إذا أردت اختبار شامل، استخدم Postman Collection:

```bash
# على جهازك المحلي
# استورد ملف: attendance-service.postman_collection.json
# غيّر BASE_URL إلى: http://SERVER_IP:5000
# غيّر TOKEN بعد Login
# شغّل جميع الـ requests في الـ collection
```

---

## 📞 دعم

إذا واجهت أي مشكلة:

1. شيّك الـ logs: `docker logs myapiplatform-attendance`
2. شيّك حالة الخدمات: `docker-compose -f docker-compose.prod.yml ps`
3. تأكد من الـ permissions في Login response
4. تأكد من أن Auth Service تم إعادة تشغيله بعد التحديث

---

**🎉 بالتوفيق في النشر!**

هذا الدليل مضمون 100% إذا اتبعته خطوة بخطوة بدون تخطي أي خطوة.
