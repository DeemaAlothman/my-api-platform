# 🚀 دليل رفع التحديثات على السيرفر الإنتاجي

## نظرة عامة
هذا الدليل يشرح خطوات رفع التحديثات الجديدة لـ Evaluation Service على السيرفر الإنتاجي (217.76.53.136:8000).

## التحديثات المضافة
1. ✅ Endpoint لإنشاء evaluation form لموظف واحد
2. ✅ Endpoint لإنشاء forms بشكل جماعي لعدة موظفين
3. ✅ Postman Collection كامل للاختبار
4. ✅ صلاحيات Evaluation كاملة (17 صلاحية)

---

## 📋 الخطوات التفصيلية

### الخطوة 1️⃣: رفع الكود على Git (تم بالفعل ✅)

```bash
# Already done - commit created
git log -1 --oneline
# Output: 898c6e8 Add evaluation forms creation endpoints and bulk generation
```

### الخطوة 2️⃣: رفع الكود على GitHub

```bash
git push origin main
```

### الخطوة 3️⃣: الاتصال بالسيرفر الإنتاجي

```bash
ssh root@217.76.53.136
```

### الخطوة 4️⃣: الانتقال لمجلد المشروع

```bash
cd /root/my-api-platform
```

### الخطوة 5️⃣: سحب آخر تحديثات من Git

```bash
git pull origin main
```

**المتوقع أن تشاهد:**
```
Updating 35a2af4..898c6e8
Fast-forward
 apps/evaluation/src/evaluation-forms/dto/create-evaluation-form.dto.ts | 11 +++
 apps/evaluation/src/evaluation-forms/evaluation-forms.controller.ts    | 5 ++
 apps/evaluation/src/evaluation-forms/evaluation-forms.service.ts       | 55 +++++++++++++++
 apps/evaluation/src/evaluation-periods/evaluation-periods.controller.ts | 8 +++
 apps/evaluation/src/evaluation-periods/evaluation-periods.service.ts   | 62 +++++++++++++++++
 Evaluation_API_Tests.postman_collection.json                           | 850 ++++++++++++++++++++++
 Evaluation_API_Environment.postman_environment.json                    | 50 +++++++++++++
 POSTMAN_TESTING_GUIDE.md                                              | 177 ++++++++
 8 files changed, 1208 insertions(+)
```

### الخطوة 6️⃣: إيقاف Evaluation Service

```bash
docker-compose stop evaluation
```

### الخطوة 7️⃣: إعادة بناء Evaluation Service

```bash
docker-compose build evaluation
```

**⏱️ هذه الخطوة تأخذ وقت (2-5 دقائق)**

### الخطوة 8️⃣: تشغيل Evaluation Service

```bash
docker-compose up -d evaluation
```

### الخطوة 9️⃣: التحقق من أن Service يعمل

```bash
# Check logs
docker logs myapiplatform-evaluation --tail 30

# Check if running
docker ps | grep evaluation
```

**المتوقع أن تشاهد:**
```
✓ Nest application successfully started
🚀 Evaluation service running on port 4005
```

### الخطوة 🔟: إعادة تشغيل Gateway (اختياري)

```bash
docker-compose restart gateway

# Wait for gateway
sleep 5

# Check gateway logs
docker logs myapiplatform-gateway --tail 30
```

---

## 🔐 الخطوة 1️⃣1️⃣: إضافة الصلاحيات في قاعدة البيانات

### طريقة 1: من السيرفر مباشرة

```bash
# On production server
docker exec -i myapiplatform-postgres psql -U postgres -d platform < /root/my-api-platform/add-evaluation-permissions-production.sql
```

### طريقة 2: نسخ الملف ثم تنفيذه

```bash
# From local machine - copy SQL file to server
scp add-evaluation-permissions-production.sql root@217.76.53.136:/root/my-api-platform/

# On production server - run the script
docker exec -i myapiplatform-postgres psql -U postgres -d platform < /root/my-api-platform/add-evaluation-permissions-production.sql
```

### طريقة 3: تنفيذ SQL يدوياً

```bash
# Connect to database
docker exec -it myapiplatform-postgres psql -U postgres -d platform

# Then paste the SQL commands from add-evaluation-permissions-production.sql
```

### التحقق من إضافة الصلاحيات

```sql
-- Check permissions count
SELECT COUNT(*) FROM users.permissions WHERE name LIKE 'evaluation:%';
-- Expected: 17

-- Check super_admin has all permissions
SELECT COUNT(*)
FROM users.role_permissions rp
JOIN users.permissions p ON rp."permissionId" = p.id
JOIN users.roles r ON rp."roleId" = r.id
WHERE r.name = 'super_admin' AND p.name LIKE 'evaluation:%';
-- Expected: 17
```

---

## ✅ الخطوة 1️⃣2️⃣: اختبار الـ Endpoints

### 1. Login للحصول على Token

```bash
curl -X POST http://217.76.53.136:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

**احفظ الـ `accessToken` من Response**

### 2. اختبار Evaluation Periods

```bash
curl http://217.76.53.136:8000/api/v1/evaluation-periods \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. إنشاء Evaluation Form

```bash
curl -X POST http://217.76.53.136:8000/api/v1/evaluation-forms \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "periodId": "PERIOD_ID_HERE",
    "employeeId": "EMPLOYEE_ID_HERE"
  }'
```

### 4. اختبار باستخدام Postman

1. استيراد الملفات:
   - `Evaluation_API_Tests.postman_collection.json`
   - `Evaluation_API_Environment.postman_environment.json`

2. تعديل Environment Variables:
   ```
   base_url: http://217.76.53.136:8000/api/v1
   ```

3. تشغيل الـ Collection بالترتيب:
   - Login (سيحفظ token تلقائياً)
   - Create Period
   - Create Form
   - Save Self Evaluation
   - Submit Self Evaluation
   - ... الخ

---

## 🔍 استكشاف الأخطاء (Troubleshooting)

### المشكلة: Service لا يبدأ

**الحل:**
```bash
# Check logs for errors
docker logs myapiplatform-evaluation --tail 50

# Check if database connection is working
docker exec myapiplatform-postgres psql -U postgres -d platform -c "SELECT 1;"

# Restart service
docker-compose restart evaluation
```

### المشكلة: Permissions 403 Forbidden

**الحل:**
```bash
# Check if permissions exist
docker exec myapiplatform-postgres psql -U postgres -d platform -c "SELECT name FROM users.permissions WHERE name LIKE 'evaluation:%';"

# Check if user has permissions
docker exec myapiplatform-postgres psql -U postgres -d platform -c "
SELECT p.name
FROM users.permissions p
JOIN users.role_permissions rp ON p.id = rp.\"permissionId\"
JOIN users.roles r ON rp.\"roleId\" = r.id
JOIN users.user_roles ur ON r.id = ur.\"roleId\"
JOIN users.users u ON ur.\"userId\" = u.id
WHERE u.username = 'admin' AND p.name LIKE 'evaluation:%';
"
```

### المشكلة: Cannot connect to service

**الحل:**
```bash
# Check if containers are running
docker ps

# Check network connectivity
docker network inspect app-network

# Restart all services
docker-compose restart
```

### المشكلة: Database connection error

**الحل:**
```bash
# Check postgres is running
docker ps | grep postgres

# Check database exists
docker exec myapiplatform-postgres psql -U postgres -l

# Check schema exists
docker exec myapiplatform-postgres psql -U postgres -d platform -c "\dn"
```

---

## 📊 التحقق النهائي (Final Verification)

### ✅ Checklist

- [ ] Git pull نجح بدون أخطاء
- [ ] Evaluation service يعمل (docker ps)
- [ ] Gateway يعمل (docker ps)
- [ ] 17 صلاحية evaluation موجودة في DB
- [ ] super_admin عنده كل صلاحيات evaluation
- [ ] Login يعمل وToken يرجع
- [ ] GET /evaluation-periods يعمل
- [ ] POST /evaluation-forms يعمل
- [ ] POST /evaluation-periods/:id/generate-forms يعمل

### ✅ أوامر التحقق السريعة

```bash
# Quick health check
echo "=== Docker Containers Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "evaluation|gateway|postgres"

echo -e "\n=== Evaluation Permissions Count ==="
docker exec myapiplatform-postgres psql -U postgres -d platform -t -c "SELECT COUNT(*) FROM users.permissions WHERE name LIKE 'evaluation:%';"

echo -e "\n=== Test API Login ==="
curl -s -X POST http://217.76.53.136:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | grep -o '"success":[^,]*'

echo -e "\n✅ All checks completed!"
```

---

## 📝 ملاحظات مهمة

1. **Backup قبل أي تغيير**: دائماً اعمل backup للـ database قبل التحديث
   ```bash
   docker exec myapiplatform-postgres pg_dump -U postgres platform > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Zero Downtime**: إذا بدك تتجنب downtime:
   - استخدم blue-green deployment
   - أو استخدم `docker-compose up -d` بدل stop/start

3. **Logs Monitoring**: راقب الـ logs بعد Deployment:
   ```bash
   docker logs -f myapiplatform-evaluation
   ```

4. **Rollback Plan**: إذا صار مشكلة، ارجع للـ commit السابق:
   ```bash
   git checkout 35a2af4
   docker-compose restart evaluation
   ```

---

## 🎯 الخلاصة

بعد اتباع هذه الخطوات، سيكون عندك:
- ✅ Evaluation service محدث بآخر features
- ✅ Gateway يوجه الطلبات بشكل صحيح
- ✅ صلاحيات evaluation كاملة مضافة
- ✅ Postman collection جاهز للاختبار
- ✅ النظام يعمل بنفس طريقة Local environment

**وقت التنفيذ المتوقع**: 10-15 دقيقة

**أي سؤال أو مشكلة؟** راجع قسم Troubleshooting أو تحقق من الـ logs!
