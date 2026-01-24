# دليل نشر واختبار Attendance Service

## 📋 المحتويات
1. [الاختبار المحلي (Local Testing)](#الاختبار-المحلي-local-testing)
2. [النشر على السيرفر (Production Deployment)](#النشر-على-السيرفر-production-deployment)
3. [استكشاف الأخطاء](#استكشاف-الأخطاء-troubleshooting)

---

## ✅ الاختبار المحلي (Local Testing)

### الخطوة 1: تثبيت الـ Dependencies

```bash
cd apps/attendance
npm install
```

### الخطوة 2: إنشاء ملف .env

أنشئ ملف `.env` في مجلد `apps/attendance`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/platform?schema=attendance"
JWT_ACCESS_SECRET="your-jwt-secret-change-in-production"
PORT=4004
NODE_ENV=development
```

### الخطوة 3: تشغيل Prisma Generate

```bash
cd apps/attendance
npx prisma generate
```

### الخطوة 4: تشغيل Migration

```bash
npx prisma migrate deploy
```

أو إذا كان database جديد:

```bash
npx prisma db push
```

### الخطوة 5: تشغيل Seed

```bash
npm run prisma:seed
```

يجب أن ترى:
```
🌱 Seeding Attendance Service database...
Creating work schedules...
✅ Created 3 work schedules
Creating attendance settings...
✅ Created attendance settings
✅ Seeding completed successfully!
```

### الخطوة 6: تشغيل الـ Service

```bash
npm run start:dev
```

يجب أن ترى:
```
Attendance Service is running on port 4004
```

### الخطوة 7: اختبار Endpoints

استخدم Postman Collection الموجود في `attendance-service.postman_collection.json`:

1. **استيراد Collection في Postman**
   - افتح Postman
   - اضغط Import
   - اختر الملف `attendance-service.postman_collection.json`

2. **تعديل baseUrl**
   - في Collection Variables، غير `baseUrl` إلى: `http://localhost:5000/api/v1`

3. **تسجيل الدخول**
   - شغّل طلب "Login"
   - الـ Token سيُحفظ تلقائياً

4. **اختبار Endpoints**
   - Work Schedules → Get All Work Schedules
   - Attendance Records → Check In
   - Attendance Records → Check Out
   - Attendance Alerts → Get My Alerts

---

## 🚀 النشر على السيرفر (Production Deployment)

### ⚠️ خطوات مهمة لتجنب الأخطاء السابقة

### الخطوة 1: رفع الكود على السيرفر

```bash
# على جهازك المحلي
cd c:/Users/user/Desktop/wso/my-api-platform
git add .
git commit -m "Add Attendance Service"
git push origin main
```

```bash
# على السيرفر
cd /path/to/my-api-platform
git pull origin main
```

### الخطوة 2: تحديث Users Service Permissions (مهم جداً!)

**يجب تشغيل هذا قبل تشغيل Attendance Service**

```bash
# على السيرفر
docker compose -f docker-compose.prod.yml exec users npx tsx prisma/seed.ts
```

يجب أن ترى الـ permissions الجديدة تُنشأ:
```
✅ Created XX permissions  (سيكون العدد أكبر من السابق)
```

### الخطوة 3: بناء ورفع Services الجديدة

```bash
# بناء الـ Images
docker compose -f docker-compose.prod.yml build attendance gateway

# إيقاف الـ Services القديمة
docker compose -f docker-compose.prod.yml down

# تشغيل كل الـ Services
docker compose -f docker-compose.prod.yml up -d
```

### الخطوة 4: التحقق من تشغيل الـ Services

```bash
# التحقق من أن كل الـ Containers تعمل
docker compose -f docker-compose.prod.yml ps
```

يجب أن ترى:
```
myapiplatform-postgres     running
myapiplatform-auth         running
myapiplatform-users        running
myapiplatform-leave        running
myapiplatform-attendance   running  ← جديد
myapiplatform-gateway      running
```

### الخطوة 5: تشغيل Attendance Migration

```bash
docker compose -f docker-compose.prod.yml exec attendance npx prisma migrate deploy
```

إذا ظهر خطأ "No migrations folder"، شغّل:

```bash
docker compose -f docker-compose.prod.yml exec attendance npx prisma db push
```

### الخطوة 6: تشغيل Attendance Seed

```bash
docker compose -f docker-compose.prod.yml exec attendance npx tsx prisma/seed.ts
```

يجب أن ترى:
```
🌱 Seeding Attendance Service database...
Creating work schedules...
✅ Created 3 work schedules
Creating attendance settings...
✅ Created attendance settings
✅ Seeding completed successfully!
```

### الخطوة 7: التحقق من Logs

```bash
# تحقق من logs الـ Attendance Service
docker compose -f docker-compose.prod.yml logs attendance

# يجب أن ترى
# Attendance Service is running on port 4004

# تحقق من logs الـ Gateway
docker compose -f docker-compose.prod.yml logs gateway

# يجب أن ترى
# 🚀 Gateway running on port 5000
```

### الخطوة 8: الاختبار من Postman

1. **تعديل Collection Variables**
   - `baseUrl`: `http://217.76.53.136:5000/api/v1`

2. **تسجيل الدخول**
   ```
   POST http://217.76.53.136:5000/api/v1/auth/login
   {
     "username": "admin",
     "password": "password123"
   }
   ```

3. **اختبار Work Schedules**
   ```
   GET http://217.76.53.136:5000/api/v1/work-schedules
   ```

4. **اختبار Check In**
   ```
   POST http://217.76.53.136:5000/api/v1/attendance-records/check-in
   {
     "location": "Office",
     "notes": "Test check-in"
   }
   ```

---

## 🔧 استكشاف الأخطاء (Troubleshooting)

### مشكلة 1: "Service attendance is unavailable"

**السبب**: Attendance Service لا يعمل

**الحل**:
```bash
# تحقق من الـ logs
docker compose -f docker-compose.prod.yml logs attendance

# إذا كان Container لا يعمل، أعد تشغيله
docker compose -f docker-compose.prod.yml restart attendance
```

### مشكلة 2: "AUTH_INSUFFICIENT_PERMISSIONS"

**السبب**: الـ Permissions لم تُضف للـ Users

**الحل**:
```bash
# أعد تشغيل Users Seed
docker compose -f docker-compose.prod.yml exec users npx tsx prisma/seed.ts

# سجل دخول جديد للحصول على Token محدّث
```

### مشكلة 3: "Employee record not found"

**السبب**: المستخدم ليس لديه Employee record في users.employees

**الحل**:
```bash
# تحقق من وجود Employee record
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d platform -c "SELECT * FROM users.employees;"

# إذا لم يوجد، أنشئ واحد أو استخدم user آخر موجود في الـ system
```

### مشكلة 4: "No migrations folder" أثناء Prisma migrate

**السبب**: مجلد migrations غير موجود في Container

**الحل**:
```bash
# استخدم db push بدلاً من migrate
docker compose -f docker-compose.prod.yml exec attendance npx prisma db push
```

### مشكلة 5: "ts-node: not found" أثناء Seed

**السبب**: tsx لم يُثبت بشكل صحيح

**الحل**:
```bash
# استخدم npx tsx بدلاً من ts-node
docker compose -f docker-compose.prod.yml exec attendance npx tsx prisma/seed.ts
```

### مشكلة 6: Database connection error

**السبب**: البيانات في ملف .env غير صحيحة

**الحل**:
```bash
# تحقق من أن ملف .env موجود وبه:
DB_USER=postgres
DB_PASSWORD=postgres  # نفس الـ password المستخدم في بقية الـ services
DB_NAME=platform
JWT_ACCESS_SECRET=your-jwt-secret-change-in-production  # نفس الـ secret في auth و users
```

---

## ✅ Checklist للنشر

- [ ] رفع الكود على Git
- [ ] Pull على السيرفر
- [ ] تحديث Users Seed (إضافة permissions)
- [ ] Build attendance و gateway
- [ ] Down ثم Up للـ containers
- [ ] التحقق من تشغيل كل الـ services
- [ ] تشغيل Attendance migration
- [ ] تشغيل Attendance seed
- [ ] التحقق من logs
- [ ] اختبار Login
- [ ] اختبار Work Schedules
- [ ] اختبار Check In/Out
- [ ] اختبار Alerts

---

## 📝 ملاحظات مهمة

1. **JWT_ACCESS_SECRET** يجب أن يكون نفسه في كل الـ services (auth, users, leave, attendance)
2. **Database credentials** يجب أن تكون نفسها في كل الـ services
3. **tsx** مهم جداً لتشغيل seed files في production
4. **Migrations folder** يجب أن يكون موجود قبل البناء
5. **Permissions** يجب إضافتها قبل تشغيل Attendance Service

---

## 🎯 الأوامر السريعة

### على السيرفر - تشغيل كامل من الصفر

```bash
# 1. Pull الكود
git pull origin main

# 2. Build الـ services الجديدة
docker compose -f docker-compose.prod.yml build attendance gateway

# 3. إيقاف وإعادة تشغيل
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# 4. انتظر 10 ثواني حتى تبدأ الـ services

# 5. تحديث Users permissions
docker compose -f docker-compose.prod.yml exec users npx tsx prisma/seed.ts

# 6. تشغيل Attendance migration
docker compose -f docker-compose.prod.yml exec attendance npx prisma db push

# 7. تشغيل Attendance seed
docker compose -f docker-compose.prod.yml exec attendance npx tsx prisma/seed.ts

# 8. تحقق من الـ logs
docker compose -f docker-compose.prod.yml logs attendance
docker compose -f docker-compose.prod.yml logs gateway

# 9. اختبار
curl http://217.76.53.136:5000/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"password123"}'
```

---

تم بناء Attendance Service بنجاح! 🎉
