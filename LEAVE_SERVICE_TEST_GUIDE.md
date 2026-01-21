# دليل اختبار Leave Service - الخطوات الصحيحة

## البيانات الأساسية المطلوبة
```
Employee ID: b0e1c442-c950-4de1-ab14-620283794298
User ID: 17ba5442-c9ce-4e26-b0ee-3da5ee2a5011

Leave Types:
- Annual Leave (إجازة سنوية): 9ab1050f-cc3f-4d35-a065-15b60132d0df
- Sick Leave (إجازة مرضية): 17e740a7-0939-47e1-be62-f67a7d62eba9
- Emergency Leave (إجازة طارئة): 5de7a506-11fd-4ea0-b6a5-c7c74a53e524
```

---

## التدفق الكامل لاختبار Leave Requests

### الخطوة 1: التحقق من رصيد الإجازات
```http
GET {{gateway_url}}/leave-balances/my?year=2024
```

**النتيجة المتوقعة**: يجب أن ترى 3 أرصدة:
- إجازة سنوية: 21 يوم
- إجازة مرضية: 15 يوم
- إجازة طارئة: 5 أيام

---

### الخطوة 2: إنشاء طلب إجازة (DRAFT)
```http
POST {{gateway_url}}/leave-requests
Content-Type: application/json

{
  "leaveTypeId": "9ab1050f-cc3f-4d35-a065-15b60132d0df",
  "startDate": "2024-02-15",
  "endDate": "2024-02-17",
  "reason": "إجازة سنوية للراحة",
  "isHalfDay": false
}
```

**ملاحظة مهمة**: الإجازة السنوية لها حد أقصى 3 أيام لكل طلب (`maxDaysPerRequest: 3`)، لذلك يجب أن تكون الفترة 3 أيام أو أقل.

**النتيجة المتوقعة**: سيتم إنشاء الطلب بحالة `DRAFT` وستحصل على `leave_request_id`.

احفظ الـ `id` من الرد لاستخدامه في الخطوات التالية.

---

### الخطوة 3: تقديم الطلب (Submit)
```http
POST {{gateway_url}}/leave-requests/{{leave_request_id}}/submit
```

**النتيجة المتوقعة**:
- الحالة ستتغير من `DRAFT` إلى `PENDING_MANAGER`
- سيتم خصم الأيام مؤقتاً من الرصيد

---

### الخطوة 4: موافقة المدير
```http
POST {{gateway_url}}/leave-requests/{{leave_request_id}}/approve-manager
Content-Type: application/json

{
  "notes": "موافقة المدير"
}
```

**النتيجة المتوقعة**:
- الحالة ستتغير من `PENDING_MANAGER` إلى `PENDING_HR`

---

### الخطوة 5: موافقة HR النهائية
```http
POST {{gateway_url}}/leave-requests/{{leave_request_id}}/approve-hr
Content-Type: application/json

{
  "notes": "موافقة نهائية من HR"
}
```

**النتيجة المتوقعة**:
- الحالة ستتغير من `PENDING_HR` إلى `APPROVED`
- سيتم تأكيد خصم الأيام من الرصيد نهائياً

---

## سيناريوهات الرفض

### رفض من قبل المدير
يجب أن يكون الطلب في حالة `PENDING_MANAGER`:

```http
POST {{gateway_url}}/leave-requests/{{leave_request_id}}/reject-manager
Content-Type: application/json

{
  "reason": "لا يمكن الموافقة في هذا الوقت"
}
```

**النتيجة**:
- الحالة تتغير إلى `REJECTED_MANAGER`
- يتم إرجاع الأيام المخصومة إلى الرصيد

---

### رفض من قبل HR
يجب أن يكون الطلب في حالة `PENDING_HR`:

```http
POST {{gateway_url}}/leave-requests/{{leave_request_id}}/reject-hr
Content-Type: application/json

{
  "reason": "رفض من HR"
}
```

**النتيجة**:
- الحالة تتغير إلى `REJECTED_HR`
- يتم إرجاع الأيام المخصومة إلى الرصيد

---

## إلغاء الطلب

### إلغاء من قبل الموظف
يمكن إلغاء الطلب في أي حالة ماعدا `CANCELLED`:

```http
POST {{gateway_url}}/leave-requests/{{leave_request_id}}/cancel
Content-Type: application/json

{
  "reason": "تغيير في الخطط"
}
```

**النتيجة**:
- الحالة تتغير إلى `CANCELLED`
- يتم إرجاع الأيام المخصومة إلى الرصيد

---

## الاستعلام عن الطلبات

### طلبات الموظف الحالي
```http
GET {{gateway_url}}/leave-requests/my/requests?status=PENDING_MANAGER
```

### جميع الطلبات (للمدراء و HR)
```http
GET {{gateway_url}}/leave-requests?status=APPROVED&year=2024
```

### طلب واحد محدد
```http
GET {{gateway_url}}/leave-requests/{{leave_request_id}}
```

---

## تحديث الطلب (فقط DRAFT)
يمكن تحديث الطلب فقط إذا كان في حالة `DRAFT`:

```http
PUT {{gateway_url}}/leave-requests/{{leave_request_id}}
Content-Type: application/json

{
  "startDate": "2024-02-16",
  "endDate": "2024-02-18",
  "reason": "سبب محدث"
}
```

---

## حذف الطلب (فقط DRAFT)
يمكن حذف الطلب فقط إذا كان في حالة `DRAFT`:

```http
DELETE {{gateway_url}}/leave-requests/{{leave_request_id}}
```

---

## الأخطاء الشائعة وحلولها

### ❌ "Request is not pending manager approval"
**السبب**: تحاول رفض/موافقة من المدير لكن الطلب ليس في حالة `PENDING_MANAGER`.
**الحل**: تحقق من حالة الطلب الحالية. يجب أن يكون `PENDING_MANAGER`.

### ❌ "Request is not pending HR approval"
**السبب**: تحاول رفض/موافقة من HR لكن الطلب ليس في حالة `PENDING_HR`.
**الحل**: يجب أن يوافق المدير أولاً ليصبح الطلب `PENDING_HR`.

### ❌ "Leave balance not found for this employee"
**السبب**: لا يوجد رصيد إجازات للموظف.
**الحل**: قم بتهيئة أرصدة الموظف أولاً:
```http
POST {{gateway_url}}/leave-balances/employee/{{employee_id}}/initialize?year=2024
```

### ❌ "Insufficient leave balance"
**السبب**: الرصيد المتبقي أقل من الأيام المطلوبة.
**الحل**: تحقق من الرصيد المتاح أو اختر نوع إجازة آخر.

### ❌ "Maximum 3 days allowed per request"
**السبب**: نوع الإجازة له حد أقصى للأيام لكل طلب.
**الحل**: قلل عدد الأيام أو اختر نوع إجازة بدون حد أقصى (مثل الإجازة المرضية).

---

## مخطط حالات الطلب (State Machine)

```
DRAFT ────────────────────────────────────────────┐
  │                                                │
  │ submit()                                       │ delete()
  │                                                │
  ▼                                                ▼
PENDING_MANAGER ────────────────────────────> DELETED
  │              │
  │              │ reject()
  │              │
  │              ▼
  │          REJECTED_MANAGER
  │
  │ approve()
  │
  ▼
PENDING_HR
  │        │
  │        │ reject()
  │        │
  │        ▼
  │    REJECTED_HR
  │
  │ approve()
  │
  ▼
APPROVED ───────> CANCELLED (cancel())
```

---

## ملاحظات مهمة

1. **التسلسل الصحيح**: يجب اتباع التسلسل: DRAFT → Submit → Manager Approve → HR Approve
2. **الصلاحيات**: تأكد من أن لديك الصلاحيات المناسبة لكل عملية
3. **الرصيد**: يجب وجود رصيد كافٍ قبل الموافقة النهائية من HR
4. **الموظف**: يجب أن يكون المستخدم مرتبط بسجل موظف في جدول `employees`
5. **التواريخ**: تأكد من صحة التواريخ واحترام حدود نوع الإجازة

---

## التحقق من البيانات

### التحقق من الموظف
```sql
SELECT id, "employeeNumber", "firstNameAr", "lastNameAr", "userId"
FROM users.employees
WHERE "userId" = '17ba5442-c9ce-4e26-b0ee-3da5ee2a5011';
```

### التحقق من الرصيد
```sql
SELECT lb.*, lt.code, lt."nameAr"
FROM leaves.leave_balances lb
JOIN leaves.leave_types lt ON lb."leaveTypeId" = lt.id
WHERE lb."employeeId" = 'b0e1c442-c950-4de1-ab14-620283794298'
AND lb.year = 2024;
```

### التحقق من الطلبات
```sql
SELECT lr.*, lt.code, lt."nameAr"
FROM leaves.leave_requests lr
JOIN leaves.leave_types lt ON lr."leaveTypeId" = lt.id
WHERE lr."employeeId" = 'b0e1c442-c950-4de1-ab14-620283794298'
ORDER BY lr."createdAt" DESC;
```
