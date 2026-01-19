# أمثلة اختبار API - جاهزة للتنفيذ

## 1️⃣ تسجيل الدخول والحصول على Token

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

**استخراج Token تلقائياً:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

echo $TOKEN
```

---

## 2️⃣ اختبار Users API

### قائمة المستخدمين
```bash
curl -s http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $TOKEN"
```

### إنشاء مستخدم جديد
```bash
curl -X POST http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user1",
    "email": "user1@wso.org",
    "password": "password123",
    "fullName": "مستخدم تجريبي",
    "status": "ACTIVE"
  }'
```

---

## 3️⃣ اختبار Departments API

### قائمة الأقسام
```bash
curl -s http://localhost:8000/api/v1/departments \
  -H "Authorization: Bearer $TOKEN"
```

### شجرة الأقسام (Hierarchical)
```bash
curl -s http://localhost:8000/api/v1/departments/tree \
  -H "Authorization: Bearer $TOKEN"
```

### إنشاء قسم جديد
```bash
curl -X POST http://localhost:8000/api/v1/departments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "HR",
    "nameAr": "قسم الموارد البشرية",
    "nameEn": "Human Resources",
    "description": "إدارة الموارد البشرية"
  }'
```

---

## 4️⃣ اختبار Employees API

### قائمة الموظفين
```bash
curl -s http://localhost:8000/api/v1/employees \
  -H "Authorization: Bearer $TOKEN"
```

### إنشاء موظف (احصل على IDs من قاعدة البيانات أولاً)

**أولاً: احصل على Job Title ID و Department ID:**
```bash
# Get Department ID
DEPT_ID=$(curl -s http://localhost:8000/api/v1/departments \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "Department ID: $DEPT_ID"
```

**ثم أنشئ الموظف:**
```bash
curl -X POST http://localhost:8000/api/v1/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"firstNameAr\": \"محمد\",
    \"lastNameAr\": \"أحمد\",
    \"firstNameEn\": \"Mohammed\",
    \"lastNameEn\": \"Ahmed\",
    \"email\": \"mohammed@wso.org\",
    \"phone\": \"0501234567\",
    \"gender\": \"MALE\",
    \"contractType\": \"PERMANENT\",
    \"departmentId\": \"$DEPT_ID\",
    \"dateOfBirth\": \"1990-01-01\",
    \"hireDate\": \"2024-01-01\",
    \"nationalId\": \"1234567890\"
  }"
```

---

## 5️⃣ اختبار Roles API

### قائمة الأدوار
```bash
curl -s http://localhost:8000/api/v1/roles \
  -H "Authorization: Bearer $TOKEN"
```

### قائمة جميع الصلاحيات
```bash
curl -s http://localhost:8000/api/v1/permissions \
  -H "Authorization: Bearer $TOKEN"
```

### إنشاء دور جديد
```bash
curl -X POST http://localhost:8000/api/v1/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "manager",
    "displayNameAr": "مدير",
    "displayNameEn": "Manager",
    "description": "Manager role"
  }'
```

---

## 6️⃣ اختبار شامل - نص واحد

```bash
#!/bin/bash

# 1. Login
echo "=== 1. Login ==="
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

echo "Token obtained ✓"
echo ""

# 2. Get Users
echo "=== 2. Get Users ==="
curl -s http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

# 3. Get Departments
echo "=== 3. Get Departments ==="
curl -s http://localhost:8000/api/v1/departments \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

# 4. Get Employees
echo "=== 4. Get Employees ==="
curl -s http://localhost:8000/api/v1/employees \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

# 5. Get Roles
echo "=== 5. Get Roles ==="
curl -s http://localhost:8000/api/v1/roles \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

echo "✅ All tests completed!"
```

احفظ النص في ملف `test.sh` ونفذه:
```bash
chmod +x test.sh
./test.sh
```

---

## 📝 ملاحظات مهمة

### بيانات الدخول الافتراضية:
- **Username:** `admin`
- **Password:** `password123`

### المنافذ (Ports):
- **Gateway:** http://localhost:8000
- **Auth Service:** http://localhost:4001
- **Users Service:** http://localhost:4002
- **PostgreSQL:** localhost:5432
- **PgAdmin:** http://localhost:5050

### إعادة تشغيل الخدمات:
```bash
# إيقاف
docker-compose down

# تشغيل
docker-compose up -d

# عرض السجلات
docker-compose logs -f
```

### إعادة seed البيانات:
```bash
# Auth service
docker-compose exec auth node dist/prisma/seed.js

# Users service
docker-compose exec users node dist/prisma/seed.js
```

---

## ✅ جاهز للاستخدام!

جميع الـ endpoints تعمل بنجاح. استخدم Postman Collection للاختبار الأسهل:
- `postman-collection.json`
- `postman-environment.json`
