# 📋 دليل الفرونت إند - نظام طلبات التوظيف (Job Applications)

## نظرة عامة
نظام إدارة طلبات التوظيف الخارجية. يتيح لفريق HR متابعة الطلبات المقدمة، مراجعتها، وتحديث حالاتها.

---

## Base URL
```
http://localhost:8000/api/v1
```
> عبر الـ Gateway - نفس بقية الـ APIs

---

## Authentication
كل الطلبات تحتاج JWT Token بالـ header:
```
Authorization: Bearer <JWT_TOKEN>
```

## الصلاحيات المطلوبة
| Permission | الوصف |
|---|---|
| `job-applications:read` | عرض الطلبات والإحصائيات |
| `job-applications:update` | تحديث حالة الطلبات |

> ⚠️ يجب إضافة هذه الصلاحيات للأدوار المناسبة (HR, Manager...) من لوحة إدارة الصلاحيات

---

## الـ Endpoints

### 1️⃣ جلب جميع الطلبات
```
GET /api/v1/job-applications
```
**Permission:** `job-applications:read`

**Query Parameters (اختيارية):**
| Parameter | Type | Default | القيم المتاحة |
|---|---|---|---|
| `status` | string | الكل | `PENDING`, `INTERVIEW_READY`, `ACCEPTED`, `REJECTED`, `HIRED`, `ALL` |
| `page` | number | 1 | رقم الصفحة |
| `limit` | number | 20 | عدد النتائج بالصفحة |

**مثال الطلب:**
```javascript
const response = await axios.get('/api/v1/job-applications', {
  headers: { Authorization: `Bearer ${token}` },
  params: { status: 'PENDING', page: 1, limit: 10 }
});
```

**مثال الاستجابة:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid-string",
        "fullName": "محمد أحمد",
        "email": "mohammad@example.com",
        "phone": "+963-11-123-4567",
        "specialization": "هندسة برمجيات",
        "yearsOfExperience": 5,
        "education": "بكالوريوس هندسة",
        "cvFileUrl": "/uploads/1234567890.pdf",
        "coverLetter": "نص الرسالة التعريفية...",
        "linkedinUrl": "https://linkedin.com/in/...",
        "ref1Name": "أحمد خالد",
        "ref1Company": "شركة ABC",
        "ref1JobTitle": "مدير تقني",
        "ref1Phone": "+963-11-111-1111",
        "ref2Name": "سامر علي",
        "ref2Company": "شركة XYZ",
        "ref2JobTitle": "مهندس أول",
        "ref2Phone": "+963-11-222-2222",
        "status": "PENDING",
        "reviewNotes": null,
        "rejectionNote": null,
        "rating": null,
        "createdAt": "2026-03-26T10:00:00.000Z",
        "updatedAt": "2026-03-26T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  },
  "meta": {
    "timestamp": "2026-03-28T10:00:00.000Z"
  }
}
```

---

### 2️⃣ إحصائيات الطلبات
```
GET /api/v1/job-applications/stats
```
**Permission:** `job-applications:read`

**مثال الطلب:**
```javascript
const response = await axios.get('/api/v1/job-applications/stats', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**مثال الاستجابة:**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "pending": 20,
    "interviewReady": 10,
    "accepted": 8,
    "rejected": 7,
    "hired": 5
  },
  "meta": {
    "timestamp": "2026-03-28T10:00:00.000Z"
  }
}
```

---

### 3️⃣ جلب طلب واحد
```
GET /api/v1/job-applications/:id
```
**Permission:** `job-applications:read`

**مثال الطلب:**
```javascript
const response = await axios.get(`/api/v1/job-applications/${applicationId}`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

**مثال الاستجابة:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "fullName": "محمد أحمد",
    "email": "mohammad@example.com",
    "phone": "+963-11-123-4567",
    "specialization": "هندسة برمجيات",
    "yearsOfExperience": 5,
    "education": "بكالوريوس هندسة",
    "cvFileUrl": "/uploads/1234567890.pdf",
    "coverLetter": "نص الرسالة التعريفية...",
    "linkedinUrl": "https://linkedin.com/in/...",
    "ref1Name": "أحمد خالد",
    "ref1Company": "شركة ABC",
    "ref1JobTitle": "مدير تقني",
    "ref1Phone": "+963-11-111-1111",
    "ref2Name": "سامر علي",
    "ref2Company": "شركة XYZ",
    "ref2JobTitle": "مهندس أول",
    "ref2Phone": "+963-11-222-2222",
    "status": "PENDING",
    "reviewNotes": "ملاحظات...",
    "rejectionNote": null,
    "rating": null,
    "createdAt": "2026-03-26T10:00:00.000Z",
    "updatedAt": "2026-03-26T10:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-03-28T10:00:00.000Z"
  }
}
```

**إذا الطلب غير موجود (404):**
```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_API_ERROR",
    "message": "الطلب غير موجود",
    "details": [{ "source": "VitaSyr", "originalStatus": 404 }]
  }
}
```

---

### 4️⃣ تحديث حالة الطلب
```
PUT /api/v1/job-applications/:id
```
**Permission:** `job-applications:update`

#### الحالات المتاحة:
| Status | المعنى | اللون المقترح | حقول إضافية مطلوبة |
|---|---|---|---|
| `PENDING` | معلق ⏳ | `#F59E0B` (أصفر) | لا شي |
| `INTERVIEW_READY` | مؤهل للمقابلة 📋 | `#3B82F6` (أزرق) | لا شي |
| `ACCEPTED` | مقبول ✅ | `#10B981` (أخضر) | `rating` (1-5) إجباري |
| `REJECTED` | مرفوض ❌ | `#EF4444` (أحمر) | `rejectionNote` إجباري |
| `HIRED` | تم التوظيف 🎉 | `#8B5CF6` (بنفسجي) | لا شي |

#### مثال: تحديث عادي (مؤهل للمقابلة)
```javascript
await axios.put(`/api/v1/job-applications/${id}`, {
  status: 'INTERVIEW_READY',
  reviewNotes: 'مرشح واعد، يحتاج مقابلة تقنية'  // اختياري
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

#### مثال: قبول (rating مطلوب)
```javascript
await axios.put(`/api/v1/job-applications/${id}`, {
  status: 'ACCEPTED',
  rating: 4,                          // ← إجباري (1-5)
  reviewNotes: 'مرشح ممتاز'          // اختياري
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

#### مثال: رفض (rejectionNote مطلوب)
```javascript
await axios.put(`/api/v1/job-applications/${id}`, {
  status: 'REJECTED',
  rejectionNote: 'لا يتوفر خبرة كافية في المجال المطلوب'  // ← إجباري
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

**الاستجابة:** الطلب المحدّث كاملاً (نفس شكل GET /:id)

---

## 📎 رابط الـ CV
ملفات CV متاحة على:
```
https://vitaxirpro.com{cvFileUrl}
```
**مثال:**
```javascript
const cvUrl = `https://vitaxirpro.com${application.cvFileUrl}`;
// النتيجة: https://vitaxirpro.com/uploads/1234567890.pdf
```
استخدمه بـ:
```html
<a href={cvUrl} target="_blank" rel="noopener noreferrer">تحميل السيرة الذاتية</a>
```

---

## ⚠️ أكواد الخطأ

| Code | المعنى | متى يظهر |
|---|---|---|
| `401` | غير مصرح - JWT مفقود أو منتهي | كل الـ endpoints |
| `403` | صلاحيات غير كافية | ما عندك `job-applications:read` أو `update` |
| `400` | بيانات غير صحيحة | مثلاً رفض بدون `rejectionNote` |
| `404` | الطلب غير موجود | GET/PUT بـ id خاطئ |
| `502` | السيرفر الخارجي واقف | VitaSyr API غير متاح |

**شكل الخطأ الموحد:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
    "message": "Insufficient permissions",
    "details": [{ "required": "job-applications:read", "userPermissions": [] }]
  },
  "meta": {
    "timestamp": "2026-03-28T10:00:00.000Z",
    "path": "/api/v1/job-applications"
  }
}
```

---

## 🎨 اقتراح صفحات الفرونت

### صفحة 1: لوحة الإحصائيات (Dashboard)
- عرض البطاقات الإحصائية من `/stats`
- إجمالي الطلبات، معلق، مقبول، مرفوض، تم التوظيف
- كل بطاقة بلون مختلف (انظر جدول الألوان أعلاه)

### صفحة 2: قائمة الطلبات (List)
- جدول مع pagination من `/job-applications`
- فلتر بالحالة (Tabs أو Dropdown)
- أعمدة: الاسم، التخصص، سنوات الخبرة، الحالة، التاريخ
- زر لفتح التفاصيل

### صفحة 3: تفاصيل طلب (Detail)
- عرض كل بيانات المتقدم من `/job-applications/:id`
- زر تحميل CV
- رابط LinkedIn
- قسم المعرّفين (Reference 1 & 2)
- أزرار تغيير الحالة:
  - "مؤهل للمقابلة" → يظهر حقل ملاحظات (اختياري)
  - "قبول" → يظهر حقل تقييم (1-5 نجوم) + ملاحظات
  - "رفض" → يظهر حقل سبب الرفض (إجباري)
  - "تم التوظيف" → تأكيد فقط

---

## 📋 Object Schema (TypeScript Interface)

```typescript
interface JobApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  specialization: string;
  yearsOfExperience: number;
  education: string;
  cvFileUrl: string;
  coverLetter: string;
  linkedinUrl: string | null;
  ref1Name: string;
  ref1Company: string;
  ref1JobTitle: string;
  ref1Phone: string;
  ref2Name: string | null;
  ref2Company: string | null;
  ref2JobTitle: string | null;
  ref2Phone: string | null;
  status: 'PENDING' | 'INTERVIEW_READY' | 'ACCEPTED' | 'REJECTED' | 'HIRED';
  reviewNotes: string | null;
  rejectionNote: string | null;
  rating: number | null;  // 1-5
  createdAt: string;       // ISO date
  updatedAt: string;       // ISO date
}

interface JobApplicationsResponse {
  data: JobApplication[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface JobApplicationStats {
  total: number;
  pending: number;
  interviewReady: number;
  accepted: number;
  rejected: number;
  hired: number;
}

interface UpdateJobApplication {
  status: 'PENDING' | 'INTERVIEW_READY' | 'ACCEPTED' | 'REJECTED' | 'HIRED';
  reviewNotes?: string;
  rejectionNote?: string;  // إجباري عند REJECTED
  rating?: number;         // إجباري عند ACCEPTED (1-5)
}
```
