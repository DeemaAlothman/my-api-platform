# 📮 دليل استخدام Postman - خطوة بخطوة

## 🔧 الإعداد الأولي

### 1. Import Collection & Environment

1. افتح Postman
2. اضغط **Import** (أعلى اليسار)
3. اسحب الملفين:
   - `postman-collection.json`
   - `postman-environment.json`
4. اختار Environment: **"My API Platform - Local"** من القائمة العلوية

---

## 🎯 كيفية استخدام الـ Requests

### خطوة 1: Login (تسجيل الدخول)

1. افتح Collection: **"My API Platform - Complete"**
2. اختار: **"1. Auth Service" → "Login"**
3. اضغط **Send**
4. **النتيجة**: Token يحفظ تلقائياً في Environment!

---

### خطوة 2: اختبار باقي الـ Endpoints

بعد Login، جميع الـ requests تشتغل مباشرة:

#### ✅ Get Users
- Request: **"2. Users" → "List Users"**
- Method: `GET`
- URL: `http://localhost:8000/api/v1/users?page=1&limit=10`
- Authorization: **تلقائي** (Token محفوظ)

#### ✅ Get Employees
- Request: **"3. Employees" → "List Employees"**
- Method: `GET`
- URL: `http://localhost:8000/api/v1/employees?page=1&limit=10`
- Authorization: **تلقائي**

#### ✅ Get Departments
- Request: **"4. Departments" → "List Departments"**
- Method: `GET`
- URL: `http://localhost:8000/api/v1/departments`
- Authorization: **تلقائي**

#### ✅ Get Roles
- Request: **"5. Roles & Permissions" → "List Roles"**
- Method: `GET`
- URL: `http://localhost:8000/api/v1/roles`
- Authorization: **تلقائي**

---

## ⚠️ حل المشاكل الشائعة

### Problem 1: "Could not send request"
**السبب:** في URL كلمة `GET` مكررة

**الحل:**
- تأكد أن الـ URL يبدأ بـ `http://` فقط
- ❌ خطأ: `GET http://localhost:8000/...`
- ✅ صح: `http://localhost:8000/...`

---

### Problem 2: "Unauthorized" Error
**السبب:** Token منتهي أو مش موجود

**الحل:**
1. شغّل **Login** request من جديد
2. Token يتحدث تلقائياً
3. أعد المحاولة

---

### Problem 3: Token مش محفوظ تلقائياً

**الحل اليدوي:**

1. شغّل **Login**
2. انسخ `accessToken` من Response:
   ```json
   {
     "data": {
       "accessToken": "eyJhbGci..."
     }
   }
   ```
3. في أي request تاني:
   - روح على tab **"Authorization"**
   - Type: اختار **"Bearer Token"**
   - Token: الصق الـ `accessToken`

---

## 📝 أمثلة Request يدوية (بدون Collection)

### Create New Request

1. اضغط **New** → **HTTP Request**
2. املأ التالي:

#### Example: Get Employees

- **Method**: `GET`
- **URL**:
  ```
  http://localhost:8000/api/v1/employees?page=1&limit=10
  ```
- **Authorization Tab**:
  - Type: `Bearer Token`
  - Token: `{{access_token}}` (إذا استخدمت Environment)
  - أو الصق Token مباشرة

#### Example: Create Department

- **Method**: `POST`
- **URL**:
  ```
  http://localhost:8000/api/v1/departments
  ```
- **Authorization Tab**:
  - Type: `Bearer Token`
  - Token: `{{access_token}}`
- **Body Tab**:
  - اختار **raw** + **JSON**
  - اكتب:
    ```json
    {
      "code": "HR",
      "nameAr": "قسم الموارد البشرية",
      "nameEn": "Human Resources",
      "description": "HR Department"
    }
    ```

---

## 🔐 بيانات الدخول الافتراضية

```json
{
  "username": "admin",
  "password": "password123"
}
```

---

## 🚀 Quick Test Script

لاختبار سريع لكل الـ endpoints:

1. Login
2. Get Users
3. Get Employees
4. Get Departments
5. Get Roles

**كل شي لازم يرجع `"success": true`**

---

## ✅ Checklist قبل كل Request

- [ ] Environment محدد: "My API Platform - Local"
- [ ] Token موجود (بعد Login)
- [ ] URL صحيح (يبدأ بـ `http://`)
- [ ] Method صحيح (GET, POST, PATCH, DELETE)
- [ ] Authorization: Bearer Token

---

## 📞 المساعدة

إذا واجهت مشكلة:

1. تأكد أن Docker شغال: `docker-compose ps`
2. شوف الـ logs: `docker-compose logs -f`
3. أعد تشغيل Services: `docker-compose restart`

---

## 🎉 نصائح مفيدة

1. **استخدم Environment Variables** - أسهل بكثير
2. **احفظ Requests** - لإعادة استخدامها
3. **استخدم Folders** - لتنظيم الـ requests
4. **Test Scripts** - للتحقق من الـ responses تلقائياً

---

**الآن جاهز للاختبار!** 🚀
