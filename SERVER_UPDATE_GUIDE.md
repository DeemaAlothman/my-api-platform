# دليل تحديث السيرفر - بدون فقدان البيانات
## WSO HR Platform - Server Deployment Guide

---

## ماذا تغيّر في هذا الإصدار؟

| الخدمة | التغيير |
|--------|---------|
| `users` | جدول `job_grades` جديد + حقول جديدة على `employees` و `job_titles` |
| `requests` | **خدمة جديدة كلياً** على port 4006 |
| `attendance` | إضافة تقارير الحضور (كود جديد فقط، لا تغيير DB) |
| `gateway` | إضافة مسار `requests` و `attendance-reports` |
| `auth` | إضافة permissions جديدة |

---

## الخطوات على السيرفر

### الخطوة 1: سحب الكود الجديد

```bash
cd /path/to/my-api-platform
git pull origin main
```

### الخطوة 2: تطبيق تغييرات قاعدة البيانات (users schema)

> **مهم**: هذه الخطوة تضيف جداول وحقول جديدة فقط، لا تحذف أي بيانات موجودة.

```bash
# الدخول إلى container الـ users (أو أي container فيه Prisma)
docker exec -it myapiplatform-users sh

# داخل الـ container:
cd /app
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@postgres:5432/platform?schema=users" \
  npx prisma db push --schema=./prisma/schema.prisma --skip-generate

exit
```

> إذا كان الـ container مش شغال بعد، شغّل postgres أولاً:
> ```bash
> docker compose -f docker-compose.prod.yml up -d postgres
> sleep 10
> ```

### الخطوة 3: تطبيق schema الطلبات الجديدة (requests schema)

> **جديد كلياً** - لا توجد بيانات قديمة، آمن 100%

```bash
# نسخ schema الـ requests
docker cp apps/requests/prisma/schema.prisma myapiplatform-postgres:/tmp/requests_schema.prisma

# تطبيق عبر psql مباشرة
docker exec -it myapiplatform-postgres psql -U postgres -d platform -c "CREATE SCHEMA IF NOT EXISTS requests;"

# أو عبر container الـ users (إذا Prisma متاح)
docker exec -it myapiplatform-users sh -c "
  DATABASE_URL='postgresql://postgres:YOUR_PASSWORD@postgres:5432/platform?schema=requests' \
  npx prisma db push --schema=/path/to/requests/prisma/schema.prisma --skip-generate
"
```

**الطريقة الأسهل** (إذا كان السيرفر عنده Docker compose):
```bash
# بناء خدمة الطلبات فقط وتشغيلها مؤقتاً لتطبيق الـ schema
docker compose -f docker-compose.prod.yml build requests
docker compose -f docker-compose.prod.yml run --rm requests sh -c \
  "npx prisma db push --schema=/app/prisma/schema.prisma --skip-generate"
```

### الخطوة 4: بناء الـ images الجديدة

```bash
# بناء الخدمات المحدثة فقط (بالترتيب)
docker compose -f docker-compose.prod.yml build \
  users \
  attendance \
  requests \
  gateway \
  auth

# إذا أردت بناء الكل:
# docker compose -f docker-compose.prod.yml build
```

> البناء يستغرق 5-10 دقائق. البيانات محفوظة في الـ volume.

### الخطوة 5: تشغيل الخدمات الجديدة

```bash
# تشغيل بشكل متتالي آمن
# أولاً: الخدمات المحدثة بدون gateway
docker compose -f docker-compose.prod.yml up -d \
  postgres \
  auth \
  users \
  leave \
  attendance \
  evaluation \
  requests

# انتظر 15 ثانية للتأكد من تشغيل كل الخدمات
sleep 15

# ثم تشغيل gateway
docker compose -f docker-compose.prod.yml up -d gateway
```

### الخطوة 6: التحقق من التشغيل

```bash
# التحقق من حالة كل الـ containers
docker compose -f docker-compose.prod.yml ps

# يجب أن يظهر الـ output:
# NAME                       STATUS    PORTS
# myapiplatform-auth         Up
# myapiplatform-users        Up
# myapiplatform-leave        Up
# myapiplatform-attendance   Up
# myapiplatform-evaluation   Up
# myapiplatform-requests     Up        <- جديد
# myapiplatform-gateway      Up        0.0.0.0:8000->8000/tcp
# myapiplatform-postgres     Up (healthy)
```

### الخطوة 7: اختبار بسيط

```bash
# اختبار تسجيل الدخول
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_ADMIN_PASSWORD"}'

# يجب أن يرجع accessToken

# اختبار خدمة الطلبات الجديدة
TOKEN="eyJ..."  # الـ token من الخطوة السابقة
curl http://localhost:8000/api/v1/requests \
  -H "Authorization: Bearer $TOKEN"

# اختبار تقارير الحضور
curl "http://localhost:8000/api/v1/attendance-reports/summary?dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $TOKEN"

# اختبار درجات الوظائف
curl http://localhost:8000/api/v1/job-grades \
  -H "Authorization: Bearer $TOKEN"
```

---

## في حالة حدوث خطأ

### إذا فشل بناء خدمة معينة:
```bash
# مشاهدة logs البناء
docker compose -f docker-compose.prod.yml build requests 2>&1

# إذا كان خطأ npm install:
# امسح cache وأعد البناء
docker builder prune -f
docker compose -f docker-compose.prod.yml build requests --no-cache
```

### إذا فشل تشغيل خدمة:
```bash
# مشاهدة logs الخدمة
docker logs myapiplatform-requests --tail=50

# إعادة تشغيل خدمة واحدة فقط
docker compose -f docker-compose.prod.yml restart requests
```

### Rollback (الرجوع للنسخة القديمة):
```bash
# الخدمات القديمة لا تزال تعمل إذا لم تعد بناؤها
# gateway القديم كان بدون requests - فقط أعد بناء gateway بالكود القديم
git stash  # أو git checkout HEAD~1 apps/gateway
docker compose -f docker-compose.prod.yml build gateway
docker compose -f docker-compose.prod.yml up -d gateway
```

---

## ملفات البيئة (.env) المطلوبة

إذا كنت تستخدم `.env` file مع `docker-compose.prod.yml`:

```env
DB_USER=postgres
DB_PASSWORD=your_strong_password_here
DB_NAME=platform

JWT_ACCESS_SECRET=your_very_long_random_secret_here_min_32_chars
JWT_REFRESH_SECRET=another_very_long_random_secret_here_min_32_chars

ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_TTL=30
```

---

## ترتيب الـ ports

| الخدمة | Port | ملاحظة |
|--------|------|--------|
| Gateway | 8000 | المدخل الرئيسي للـ API |
| Auth | 4001 | داخلي فقط |
| Users | 4002 | داخلي فقط |
| Leave | 4003 | داخلي فقط |
| Attendance | 4004 | داخلي فقط |
| Evaluation | 4005 | داخلي فقط |
| **Requests** | **4006** | **جديد - داخلي فقط** |
| PostgreSQL | - | داخلي فقط (لا يفتح للخارج) |

---

## ملاحظات مهمة

1. **البيانات محفوظة**: الـ `pgdata` volume لا يُمس في أي خطوة.
2. **الخدمات القديمة**: attendance, leave, evaluation لم يتغير DB الخاص بها.
3. **الـ users schema**: تغيّرات additive فقط (إضافة جداول وأعمدة، لا حذف).
4. **الـ requests schema**: جديد كلياً، لا يمس أي بيانات موجودة.
5. **Downtime**: يمكن تحديث كل خدمة بشكل مستقل لتقليل وقت التوقف.
