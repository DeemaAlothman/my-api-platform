# 📮 دليل Postman - Leave Service

## 📥 الاستيراد

### 1. استيراد Collection
1. افتح Postman
2. اضغط **Import** (أعلى اليسار)
3. اختر ملف: `postman-leave-service.json`
4. اضغط **Import**

### 2. استيراد Environment
1. اضغط **Import** مرة أخرى
2. اختر ملف: `postman-leave-environment.json`
3. اضغط **Import**
4. اختر Environment "Leave Service - Local" من القائمة المنسدلة (أعلى اليمين)

---

## 🔑 الخطوة 1: Login

قبل أي شيء، يجب تسجيل الدخول:

1. افتح المجلد: **1. Auth**
2. اختر: **Login**
3. اضغط **Send**

سيحفظ الـ `access_token` تلقائياً في Environment!

---

## 📋 الخطوة 2: احصل على IDs المطلوبة

### A. احصل على Leave Type ID
1. افتح المجلد: **2. Leave Types**
2. اختر: **Get All Leave Types**
3. اضغط **Send**
4. انسخ `id` من أي نوع (مثل ANNUAL)
5. ضعه في Environment → `leave_type_id`

### B. احصل على Employee ID
1. اذهب للـ Collection الأصلي (Users Service)
2. أو ضع ID الموظف يدوياً في `employee_id`

---

## 🧪 الخطوة 3: ابدأ الاختبار

### سيناريو كامل:

#### 1️⃣ عرض أنواع الإجازات
```
2. Leave Types → Get All Leave Types
```

#### 2️⃣ عرض العطل الرسمية 2024
```
3. Holidays → Get Holidays by Year
```

#### 3️⃣ عرض رصيدي
```
4. Leave Balances → Get My Balance
```

#### 4️⃣ إنشاء طلب إجازة
```
5. Leave Requests → Create Leave Request
```
سيحفظ `leave_request_id` تلقائياً!

#### 5️⃣ تقديم الطلب
```
5. Leave Requests → Submit Leave Request
```

#### 6️⃣ موافقة المدير
```
5. Leave Requests → Approve Manager
```

#### 7️⃣ موافقة HR
```
5. Leave Requests → Approve HR
```

#### 8️⃣ عرض تفاصيل الطلب (مع التاريخ)
```
5. Leave Requests → Get Request Details
```

---

## 📚 الـ Endpoints المتوفرة

### 🟢 Leave Types (7 endpoints)
- Get All Leave Types
- Get Active Leave Types
- Get Leave Type by ID
- Get Leave Type by Code
- Create Leave Type
- Update Leave Type

### 🟡 Holidays (5 endpoints)
- Get All Holidays
- Get Holidays by Year
- Get Upcoming Holidays
- Get Holidays in Range
- Create Holiday

### 🔵 Leave Balances (6 endpoints)
- Get My Balance
- Get Employee Balance
- Create Balance
- Adjust Balance
- Initialize Employee Balances
- Carry Over Balance

### 🔴 Leave Requests (14 endpoints)
- Get My Requests
- Get All Requests (HR)
- Get Request Details
- Create Leave Request
- Create Half-Day Request
- Update Leave Request
- Submit Leave Request
- Approve Manager
- Reject Manager
- Approve HR
- Reject HR
- Cancel Leave Request
- Delete Leave Request

---

## 🎯 نصائح مهمة

### 1. الـ Token
- الـ Token يُحفظ تلقائياً بعد Login
- صالح لمدة **15 دقيقة**
- إذا انتهى، سجل دخول مرة أخرى

### 2. الـ IDs
- `leave_type_id` - احصل عليه من "Get All Leave Types"
- `employee_id` - ضعه يدوياً أو احصل عليه من Users Service
- `leave_request_id` - يُحفظ تلقائياً بعد "Create Leave Request"

### 3. الحالات (Status Flow)
```
DRAFT → submit() → PENDING_MANAGER → approve() → PENDING_HR → approve() → APPROVED
```

### 4. Dates
- استخدم صيغة: `YYYY-MM-DD`
- مثال: `2024-02-15`
- تأكد أن التاريخ **في المستقبل**

### 5. Half Day
عند إنشاء نصف يوم:
```json
{
  "isHalfDay": true,
  "halfDayPeriod": "MORNING"  // أو "AFTERNOON"
}
```

---

## 🐛 حل المشاكل

### ❌ Unauthorized
- سجل دخول مرة أخرى (Token انتهى)

### ❌ Leave Type not found
- تأكد من وضع `leave_type_id` صحيح في Environment

### ❌ Insufficient balance
- تحقق من رصيدك: "Get My Balance"
- إذا لم يكن لديك رصيد، استخدم "Initialize Employee Balances"

### ❌ Cannot modify request
- يمكن التعديل فقط في حالة DRAFT
- بعد Submit، استخدم Cancel ثم أنشئ طلب جديد

---

## 🚀 Local vs Server

### Local (Development)
```
gateway_url = http://localhost:8000/api/v1
```

### Server (Production)
```
gateway_url = http://YOUR_SERVER_IP:5000/api/v1
```

غيّر في Environment حسب البيئة!

---

**✨ جاهز للاختبار! ابدأ بـ Login ثم جرّب باقي الـ endpoints.**
