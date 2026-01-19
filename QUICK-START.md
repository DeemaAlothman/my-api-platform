# ⚡ Quick Start Guide

## 🎯 الطريقة الأسرع (موصى بها)

### الخطوة 1: شغّل Docker Desktop
تأكد أن Docker Desktop شغال (شوف الأيقونة في System Tray)

### الخطوة 2: شغّل كل شي
```bash
cd C:\Users\user\Desktop\wso\my-api-platform
docker-compose up -d
```

### الخطوة 3: انتظر 30 ثانية
الخدمات بتجهز تلقائياً

### الخطوة 4: اختبر
افتح Postman → Import الملفات → Login

---

## 🐛 إذا في مشكلة Prisma

إذا شفت error: `Property 'refreshToken' does not exist`

### الحل:
```bash
# Auth Service
cd apps/auth
npx prisma generate
cd ../..

# Users Service
cd apps/users
npx prisma generate
cd ../..

# بعدها أعد تشغيل
docker-compose restart auth users
```

---

## 📝 أول مرة تشغيل؟

إذا أول مرة، لازم تعمل migrations + seed:

```bash
# 1. شغّل PostgreSQL
docker-compose up -d postgres

# 2. انتظر 10 ثواني

# 3. Auth Service
cd apps/auth
npx prisma migrate deploy
npm run prisma:seed
cd ../..

# 4. Users Service
cd apps/users
npx prisma migrate deploy
npm run prisma:seed
cd ../..

# 5. شغّل كل الخدمات
docker-compose up -d
```

---

## ✅ تحقق من التشغيل

```bash
# شوف حالة الخدمات
docker-compose ps

# يجب أن تكون كلها Up (healthy)
```

افتح المتصفح:
- Gateway Health: http://localhost:8000/api/v1/health
- Auth Health: http://localhost:4001/api/v1/health
- Users Health: http://localhost:4002/api/v1/health

---

## 🔑 بيانات الدخول

**API:**
- Username: `admin`
- Password: `password123`

**PgAdmin (http://localhost:5050):**
- Email: `admin@local.com`
- Password: `admin`

---

## 🛑 إيقاف

```bash
docker-compose down
```

---

**خلاص! جاهز للاختبار** 🚀
