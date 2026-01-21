# 🚀 دليل التشغيل - My API Platform

## المتطلبات
- ✅ Docker Desktop مثبت وشغال
- ✅ Node.js 20+ مثبت
- ✅ PostgreSQL (عن طريق Docker)

---

## 🔧 خطوات التشغيل

### الطريقة 1: باستخدام Docker (موصى بها)

```bash
# 1. شغّل Docker Desktop أولاً
# تأكد أنه شغال من System Tray

# 2. شغّل كل الخدمات
cd ~/Desktop/wso/my-api-platform
docker-compose up -d

# 3. شاهد الـ logscd
docker-compose logs -f

# 4. تحقق من الخدمات
docker-compose ps
```

**الخدمات رح تكون متاحة على:**
- Gateway: http://localhost:8000
- Auth Service: http://localhost:4001
- Users Service: http://localhost:4002
- PostgreSQL: localhost:5432
- PgAdmin: http://localhost:5050

---

### الطريقة 2: تشغيل محلي (Development)

#### 1. شغّل PostgreSQL فقط

```bash
# شغّل فقط الـ database
docker-compose up -d postgres

# انتظر 10 ثواني حتى يجهز
```

#### 2. شغّل Auth Service

```bash
cd apps/auth
npm run start:dev
```

#### 3. شغّل Users Service (في terminal جديد)

```bash
cd apps/users
npm run start:dev
```

#### 4. شغّل Gateway (في terminal جديد)

```bash
cd apps/gateway
npm run start:dev
```

---

## 🗄️ إعداد Database (أول مرة فقط)

### Auth Service Database

```bash
cd apps/auth

# Run migrations
npx prisma migrate deploy

# Seed initial data (admin user)
npm run prisma:seed
```

**بيانات الدخول:**
- Username: `admin`
- Password: `password123`

### Users Service Database

```bash
cd apps/users

# Run migrations
npx prisma migrate deploy

# Seed initial data (permissions, roles, departments)
npm run prisma:seed
```

### Leave Service Database

```bash
cd apps/leave

# Run migrations
npx prisma migrate deploy

# Seed initial data (leave types, holidays)
npm run prisma:seed
```

**أو باستخدام Docker:**

```bash
# تنفيذ migrations
docker compose exec leave npx prisma migrate deploy

# تنفيذ seed
docker compose exec leave npx tsx prisma/seed.ts
```

**البيانات اللي رح تتضاف:**
- 10 أنواع إجازات (سنوية، مرضية، طارئة، إلخ)
- 5 عطلات رسمية

**التحقق من البيانات:**
```bash
# عرض أنواع الإجازات
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT code, \"nameAr\", \"defaultDays\" FROM leaves.leave_types;"

# عرض العطلات
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT \"nameAr\", date FROM leaves.holidays ORDER BY date;"
```

---

## 🧪 اختبار الخدمات

### باستخدام cURL

```bash
# Test Gateway Health
curl http://localhost:8000/api/v1/health

# Test Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

### باستخدام Postman

1. Import الملفات:
   - `postman-collection.json`
   - `postman-environment.json`

2. اختر Environment: **"My API Platform - Local"**

3. شغّل **Login** request أولاً

4. اختبر باقي الـ endpoints

---

## 🛑 إيقاف الخدمات

### Docker

```bash
# إيقاف كل الخدمات
docker-compose down

# إيقاف + حذف الـ volumes (Database)
docker-compose down -v
```

### Development Mode

```bash
# اضغط Ctrl+C في كل terminal
```

---

## 📊 مراقبة الخدمات

### Logs

```bash
# كل الخدمات
docker-compose logs -f

# خدمة معينة
docker-compose logs -f gateway
docker-compose logs -f auth
docker-compose logs -f users
```

### Database Management

افتح PgAdmin: http://localhost:5050

**بيانات الدخول:**
- Email: admin@local.com
- Password: admin

**اتصال بالـ Database:**
- Host: postgres
- Port: 5432
- Database: platform
- Username: postgres
- Password: postgres

---

## 🐛 حل المشاكل

### مشكلة: "Can't reach database server"

```bash
# تأكد أن PostgreSQL شغال
docker-compose ps postgres

# إعادة تشغيل
docker-compose restart postgres
```

### مشكلة: "Port already in use"

```bash
# شوف شو استخدم الـ port
netstat -ano | findstr :8000

# أوقف الـ process
taskkill /PID <process_id> /F
```

### مشكلة: Prisma Client مش متوافق

```bash
cd apps/users
npx prisma generate

cd ../auth
npx prisma generate
```

---

## 🔄 إعادة بناء الخدمات

```bash
# إعادة بناء كل شي
docker-compose up -d --build

# بناء خدمة واحدة
docker-compose up -d --build gateway
```

---

## 📝 ملاحظات مهمة

1. **أول مرة:** لازم تشغل migrations + seed للـ databases
2. **Docker Desktop:** لازم يكون شغال قبل ما تشغل docker-compose
3. **Ports:** تأكد أن Ports 8000, 4001, 4002, 5432 مش مستخدمين
4. **JWT Secret:** غيّر الـ secrets في docker-compose.yml قبل Production

---

**مبروك! خدماتك شغالة الآن** 🎉
