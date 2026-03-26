# دليل الفرونت — نظام الموافقات الديناميكي والتعديلات الجديدة

> هذا الملف يوثق **فقط** التغييرات المُضافة في مرحلة تطوير نظام الموافقات الديناميكي.
> للتغييرات السابقة (الكودات التلقائية، نموذج الموظف، إلخ) راجع `FRONTEND_CHANGES.md`.

---

## 1. أنواع الطلبات الجديدة (RequestType)

أضف هذه الأنواع السبعة لقائمة أنواع الطلبات الإدارية:

```typescript
// الأنواع القديمة (موجودة مسبقاً)
TRANSFER          // نقل
PERMISSION        // إذن
ADVANCE           // سلفة
RESIGNATION       // استقالة
JOB_CHANGE        // تغيير وظيفي
RIGHTS            // استحقاقات
REWARD            // مكافأة
SPONSORSHIP       // كفالة
OTHER             // أخرى

// الأنواع الجديدة ✨
PENALTY_PROPOSAL  // اقتراح جزاء
OVERTIME_EMPLOYEE // إضافي موظف
OVERTIME_MANAGER  // إضافي مدير
BUSINESS_MISSION  // مهمة عمل
DELEGATION        // تفويض
HIRING_REQUEST    // طلب توظيف
COMPLAINT         // شكوى
```

---

## 2. حقل details — بنية البيانات لكل نوع طلب

عند إنشاء طلب، أرسل حقل `details` (JSON object) حسب النوع. الباكند سيرفض الطلب إذا كانت الحقول المطلوبة ناقصة.

### RESIGNATION — استقالة
```json
{
  "effectiveDate": "2026-04-20",   // مطلوب — لا يقل عن 30 يوم من اليوم
  "reasons": "أسباب الاستقالة"     // مطلوب
}
```
> **تحقق في الفرونت:** تاريخ الاستقالة يجب أن يكون بعد 30 يوماً على الأقل من اليوم.

---

### TRANSFER — نقل
```json
{
  "currentDepartmentId": "uuid",  // مطلوب
  "currentJobTitleId": "uuid",    // مطلوب
  "newDepartmentId": "uuid",      // مطلوب
  "newJobTitleId": "uuid"         // مطلوب
}
```

---

### PENALTY_PROPOSAL — اقتراح جزاء
```json
{
  "targetEmployeeId": "uuid",           // مطلوب — الموظف المقترح بحقه الجزاء
  "targetJobTitle": "مسمى وظيفي",       // مطلوب
  "violationDescription": "وصف المخالفة" // مطلوب
}
```

---

### OVERTIME_EMPLOYEE — طلب إضافي (موظف)
```json
{
  "overtimeDate": "2026-03-17",   // مطلوب — تاريخ العمل الإضافي
  "startTime": "17:00",           // مطلوب
  "endTime": "20:00",             // مطلوب
  "totalHours": 3,                // مطلوب
  "tasks": "وصف المهام المنجزة"    // مطلوب
}
```
> **قاعدة:** إذا كان التاريخ هو اليوم، لا يمكن تقديم الطلب بعد الساعة 12:00 ظهراً.

---

### OVERTIME_MANAGER — طلب إضافي (مدير لفريقه)
```json
{
  "overtimeDate": "2026-03-17",   // مطلوب
  "startTime": "17:00",           // مطلوب
  "endTime": "21:00",             // مطلوب
  "totalHours": 4,                // مطلوب
  "purpose": "الغرض من العمل الإضافي" // مطلوب
}
```
> نفس قاعدة الـ 12 ظهراً تنطبق هنا.

---

### BUSINESS_MISSION — مهمة عمل
```json
{
  "missionType": "INTERNAL",        // مطلوب — "INTERNAL" أو "EXTERNAL" فقط
  "startDate": "2026-03-20",        // مطلوب
  "endDate": "2026-03-22",          // مطلوب
  "totalDays": 3,                   // مطلوب
  "destination": "الرياض",           // مطلوب
  "missionReason": "حضور مؤتمر"     // مطلوب
}
```

---

### DELEGATION — تفويض
```json
{
  "delegationType": "FULL",          // مطلوب — "FULL" أو "PARTIAL" فقط
  "startDate": "2026-03-20",         // مطلوب
  "endDate": "2026-03-25",           // مطلوب
  "delegateEmployeeId": "uuid",      // مطلوب — الموظف المفوَّض إليه
  "delegateJobTitle": "مسمى وظيفي"   // مطلوب
}
```

---

### HIRING_REQUEST — طلب توظيف
```json
{
  "positions": [                     // مطلوب — مصفوفة (1-10 وظائف)
    {
      "departmentId": "uuid",        // مطلوب
      "jobTitle": "مسمى الوظيفة",    // مطلوب
      "count": 2,                    // مطلوب — عدد الشواغر
      "reason": "سبب الاحتياج"       // مطلوب
    }
  ]
}
```

---

### REWARD — مكافأة
```json
{
  "employees": [                     // مطلوب — مصفوفة (1-10 موظفين)
    {
      "employeeId": "uuid",          // مطلوب
      "rewardType": "نوع المكافأة",   // مطلوب
      "amount": 500,                 // مطلوب
      "reason": "سبب المكافأة"        // مطلوب
    }
  ]
}
```

---

### COMPLAINT — شكوى
```json
{
  "complaintDescription": "تفاصيل الشكوى" // مطلوب
}
```

---

### الأنواع بدون details إلزامية
الأنواع التالية لا تحتاج `details`، حقل `reason` في الطلب الأساسي يكفي:
`PERMISSION`, `ADVANCE`, `JOB_CHANGE`, `RIGHTS`, `SPONSORSHIP`, `OTHER`

---

## 3. حالة جديدة للطلبات (RequestStatus)

```typescript
// الحالات القديمة
DRAFT
PENDING_MANAGER
PENDING_HR
APPROVED
REJECTED
CANCELLED

// الحالة الجديدة ✨
IN_APPROVAL   // الطلب يمر بمراحل الموافقة الديناميكية
```

> عند استخدام الـ endpoints الجديدة (`/approve`, `/reject`)، الطلب يأخذ حالة `IN_APPROVAL` تلقائياً بعد الـ submit.

---

## 4. Endpoints الجديدة

### Base URL: `/api/v1/requests`

---

### 4.1 جلب الطلبات المنتظرة موافقتي
```
GET /requests/pending-my-approval
```
**Headers:** `Authorization: Bearer <token>`

**Query Params:**
| الحقل | النوع | الافتراضي |
|---|---|---|
| `page` | number | 1 |
| `limit` | number | 10 |

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "requestNumber": "VTX-LRQ-000001",
        "type": "RESIGNATION",
        "status": "IN_APPROVAL",
        "currentStepOrder": 1,
        "currentStep": {
          "id": "uuid",
          "stepOrder": 1,
          "approverRole": "DIRECT_MANAGER",
          "status": "PENDING"
        },
        "approvalSteps": [...],
        "createdAt": "2026-03-17T..."
      }
    ],
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

> **الاستخدام:** صفحة "الطلبات المعلقة" للمديرين وHR — تعرض الطلبات التي يستطيع المستخدم الحالي الموافقة عليها.

---

### 4.2 جلب خطوات الموافقة لطلب معين
```
GET /requests/:id/approvals
```
**Headers:** `Authorization: Bearer <token>`

**الاستجابة:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "requestId": "uuid",
      "stepOrder": 1,
      "approverRole": "DIRECT_MANAGER",
      "status": "APPROVED",
      "reviewedBy": "employee-uuid",
      "reviewedAt": "2026-03-17T10:00:00Z",
      "notes": "موافق",
      "createdAt": "2026-03-17T..."
    },
    {
      "id": "uuid",
      "requestId": "uuid",
      "stepOrder": 2,
      "approverRole": "HR",
      "status": "PENDING",
      "reviewedBy": null,
      "reviewedAt": null,
      "notes": null,
      "createdAt": "2026-03-17T..."
    }
  ]
}
```

> **الاستخدام:** عرض timeline للموافقات داخل صفحة تفاصيل الطلب.

---

### 4.3 الموافقة على الخطوة الحالية
```
POST /requests/:id/approve
```
**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "notes": "تمت المراجعة والموافقة"   // اختياري
}
```

**الاستجابة:** الطلب المحدَّث كاملاً مع approvalSteps.

> **ملاحظة:** الباكند يتحقق تلقائياً إذا كان المستخدم الحالي مخوَّلاً للموافقة على الخطوة الحالية. إذا لم يكن مخوَّلاً سيعيد `403 Forbidden`.

---

### 4.4 رفض الخطوة الحالية
```
POST /requests/:id/reject
```
**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "reason": "سبب الرفض"   // مطلوب عند الرفض
}
```

**الاستجابة:** الطلب المحدَّث بحالة `REJECTED`.

---

### 4.5 Endpoints القديمة (لا تزال تعمل)
هذه الـ endpoints موجودة للتوافق مع الكود القديم ولكن يُفضَّل الانتقال للنظام الجديد:

| Endpoint | الحالة |
|---|---|
| `POST /:id/manager-approve` | يعمل — deprecated |
| `POST /:id/manager-reject` | يعمل — deprecated |
| `POST /:id/hr-approve` | يعمل — deprecated |
| `POST /:id/hr-reject` | يعمل — deprecated |

---

## 5. تغييرات على بنية استجابة الطلب (Request Object)

أضيفت حقول جديدة لكائن الطلب:

```typescript
{
  id: string
  requestNumber: string
  type: RequestType
  status: RequestStatus
  reason?: string
  notes?: string
  attachmentUrl?: string
  details?: object            // بيانات إضافية حسب نوع الطلب
  currentStepOrder?: number   // ✨ رقم الخطوة الحالية في الموافقة
  targetEmployeeId?: string   // ✨ للطلبات التي تستهدف موظفاً آخر (PENALTY_PROPOSAL)
  approvalSteps?: ApprovalStep[]  // ✨ مضافة في GET /:id وقائمة الطلبات
  employeeId: string
  createdAt: string
  updatedAt: string
}
```

### ApprovalStep Object:
```typescript
{
  id: string
  requestId: string
  stepOrder: number                // 1, 2, 3...
  approverRole: ApproverRole       // DIRECT_MANAGER | DEPARTMENT_MANAGER | TARGET_MANAGER | HR | CEO | CFO
  status: ApprovalStatus           // PENDING | APPROVED | REJECTED | SKIPPED
  reviewedBy?: string              // employeeId من وافق/رفض
  reviewedAt?: string              // وقت القرار
  notes?: string
  createdAt: string
}
```

---

## 6. مسارات الموافقة لكل نوع طلب

| نوع الطلب | المرحلة 1 | المرحلة 2 | المرحلة 3 |
|---|---|---|---|
| RESIGNATION | مدير مباشر | HR | — |
| TRANSFER | مدير مباشر | HR | — |
| PERMISSION | مدير مباشر | — | — |
| ADVANCE | مدير مباشر | HR | CFO |
| JOB_CHANGE | مدير مباشر | HR | — |
| RIGHTS | HR | — | — |
| REWARD | مدير مباشر | HR | CEO |
| SPONSORSHIP | مدير مباشر | HR | — |
| OTHER | مدير مباشر | — | — |
| PENALTY_PROPOSAL ✨ | مدير مباشر | HR | CEO |
| OVERTIME_EMPLOYEE ✨ | مدير مباشر | HR | — |
| OVERTIME_MANAGER ✨ | HR | CEO | — |
| BUSINESS_MISSION ✨ | مدير مباشر | HR | CEO |
| DELEGATION ✨ | مدير مباشر | مدير المفوَّض إليه | HR |
| HIRING_REQUEST ✨ | مدير القسم | HR | CEO |
| COMPLAINT ✨ | HR | CEO | — |

---

## 7. حقل attachmentUrl في طلبات الإجازة

أضيف حقل `attachmentUrl` لطلبات الإجازة:

```typescript
// POST /leave-requests
{
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string
  contactDuring?: string
  attachmentUrl?: string   // ✨ جديد — رابط المستند/التقرير الطبي إلخ
}
```

يظهر أيضاً في استجابة `GET /leave-requests` و `GET /leave-requests/:id`.

---

## 8. الصلاحيات الجديدة

| الصلاحية | الوصف | من يحتاجها |
|---|---|---|
| `requests:approve` | الموافقة على خطوات الموافقة | المديرون، HR، CEO، CFO |
| `requests:reject` | رفض خطوات الموافقة | المديرون، HR، CEO، CFO |
| `requests:ceo-approve` | الموافقة بصفة CEO | CEO |
| `requests:cfo-approve` | الموافقة بصفة CFO | CFO |
| `requests:hr-approve` | الموافقة بصفة HR | HR |
| `requests:read-all-steps` | عرض جميع خطوات الموافقة | HR، المديرون |
| `requests:manage-workflows` | إدارة تكوينات سير العمل | super_admin |

> **ملاحظة:** الـ `super_admin` يملك جميع الصلاحيات تلقائياً.

---

## 9. سيناريو كامل — دورة حياة طلب

### مثال: تقديم طلب استقالة

```
1. POST /requests
   Body: { type: "RESIGNATION", reason: "...", details: { effectiveDate: "2026-04-20", reasons: "..." } }
   → status: DRAFT

2. POST /requests/:id/submit
   → status: IN_APPROVAL, currentStepOrder: 1
   → تُنشأ خطوتان: DIRECT_MANAGER (PENDING) + HR (PENDING)

3. المدير المباشر: POST /requests/:id/approve
   Body: { notes: "موافق" }
   → الخطوة 1: APPROVED
   → status: IN_APPROVAL, currentStepOrder: 2

4. HR: POST /requests/:id/approve
   Body: { notes: "تمت المراجعة" }
   → الخطوة 2: APPROVED
   → status: APPROVED (مكتمل)
```

---

## 10. الأخطاء المتوقعة

| الكود | السبب |
|---|---|
| `VALIDATION_ERROR` | حقول details ناقصة أو غير صحيحة |
| `AUTH_INSUFFICIENT_PERMISSIONS` | المستخدم غير مخوَّل للموافقة على هذه الخطوة |
| `RESOURCE_NOT_FOUND` | الطلب غير موجود |
| `VALIDATION_ERROR` (status) | الطلب ليس في حالة IN_APPROVAL عند محاولة الموافقة |
