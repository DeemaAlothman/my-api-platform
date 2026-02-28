# دليل API الكامل للفرونت إند
## WSO HR Platform - Frontend API Reference

**Base URL:** `http://YOUR_SERVER:8000/api/v1`

---

## التوثيق (Authentication)

جميع الطلبات تحتاج `Authorization: Bearer {token}` في الـ header ما عدا تسجيل الدخول.

### تسجيل الدخول
```
POST /auth/login
```
**Body:**
```json
{ "username": "admin", "password": "password123" }
```
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@example.com",
      "fullName": "مدير النظام",
      "roles": ["super_admin"],
      "permissions": ["users:read", "employees:read", "requests:read", ...]
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### تجديد التوكن
```
POST /auth/refresh
Body: { "refreshToken": "eyJ..." }
```

### تسجيل الخروج
```
POST /auth/logout
Body: { "refreshToken": "eyJ..." }
```

---

## الشكل العام للـ Response

### نجاح
```json
{ "success": true, "data": { ... } }
```
### نجاح مع pagination
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```
### خطأ
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "رسالة الخطأ",
    "details": [...]
  }
}
```

---

## 1. إدارة المستخدمين (Users)

### قائمة المستخدمين
```
GET /users?page=1&limit=20&search=أحمد
```

### إنشاء مستخدم
```
POST /users
```
```json
{
  "username": "john.doe",
  "email": "john@example.com",
  "password": "Pass@1234",
  "fullName": "John Doe",
  "roles": ["employee"]
}
```

### تفاصيل مستخدم
```
GET /users/:id
```

### تحديث مستخدم
```
PATCH /users/:id
Body: (نفس حقول الإنشاء، كلها اختيارية)
```

### حذف مستخدم
```
DELETE /users/:id
```

---

## 2. الموظفون (Employees)

### قائمة الموظفين
```
GET /employees?page=1&limit=20&search=&departmentId=&status=
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [{
      "id": "uuid",
      "employeeNumber": "EMP000001",
      "firstNameAr": "أحمد",
      "lastNameAr": "محمد",
      "firstNameEn": "Ahmed",
      "lastNameEn": "Mohammed",
      "email": "ahmed@example.com",
      "jobTitleId": "uuid",
      "jobGradeId": "uuid",
      "departmentId": "uuid",
      "basicSalary": "5000.00",
      "hireDate": "2024-01-01",
      "status": "ACTIVE"
    }],
    "total": 100
  }
}
```

### إنشاء موظف
```
POST /employees
```
```json
{
  "firstNameAr": "أحمد",
  "lastNameAr": "محمد",
  "firstNameEn": "Ahmed",
  "lastNameEn": "Mohammed",
  "email": "ahmed@example.com",
  "phone": "+966501234567",
  "nationalId": "1234567890",
  "departmentId": "uuid",
  "jobTitleId": "uuid",
  "jobGradeId": "uuid",
  "basicSalary": 5000,
  "hireDate": "2024-01-01",
  "userId": "uuid"
}
```
> `basicSalary` **[جديد]**: الراتب الأساسي للموظف
> `jobGradeId` **[جديد]**: ربط الموظف بالدرجة الوظيفية

### الهيكل التنظيمي (Org Chart) - **[محدّث: عمق غير محدود]**
```
GET /departments/tree
```
**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "nameAr": "الإدارة العامة",
    "nameEn": "General Management",
    "children": [{
      "id": "uuid",
      "nameAr": "قسم تقنية المعلومات",
      "children": [{
        "id": "uuid",
        "nameAr": "فريق التطوير",
        "children": []
      }]
    }]
  }]
}
```
> الشجرة تدعم عمق غير محدود من الأقسام الفرعية.

---

## 3. المسميات الوظيفية (Job Titles) - **[محدّث]**

### قائمة المسميات
```
GET /job-titles?page=1&limit=20&gradeId=
```
**Response يشمل الآن:**
```json
{
  "items": [{
    "id": "uuid",
    "code": "DEV",
    "nameAr": "مطور برمجيات",
    "nameEn": "Software Developer",
    "description": "مسؤول عن تطوير التطبيقات",
    "gradeId": "uuid",
    "grade": {
      "id": "uuid",
      "code": "G3",
      "nameAr": "الدرجة الثالثة",
      "minSalary": "5000",
      "maxSalary": "8000"
    }
  }]
}
```

### إنشاء مسمى وظيفي
```
POST /job-titles
```
```json
{
  "code": "DEV",
  "nameAr": "مطور برمجيات",
  "nameEn": "Software Developer",
  "nameTr": "Yazılım Geliştirici",
  "description": "مسؤول عن تطوير وصيانة التطبيقات",
  "gradeId": "uuid"
}
```
> `description` **[جديد]**: وصف المسمى الوظيفي
> `gradeId` **[جديد]**: ربط المسمى بالدرجة الوظيفية

---

## 4. الدرجات الوظيفية (Job Grades) - **[جديد كلياً]**

### قائمة الدرجات
```
GET /job-grades?page=1&limit=20&isActive=true
```
**Response:**
```json
{
  "success": true,
  "data": {
    "items": [{
      "id": "uuid",
      "code": "G3",
      "nameAr": "الدرجة الثالثة",
      "nameEn": "Grade 3",
      "description": "درجة للموظفين المتوسطين",
      "color": "#3498db",
      "minSalary": "5000.00",
      "maxSalary": "8000.00",
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }],
    "total": 5
  }
}
```

### إنشاء درجة وظيفية
```
POST /job-grades
```
```json
{
  "code": "G3",
  "nameAr": "الدرجة الثالثة",
  "nameEn": "Grade 3",
  "description": "درجة للموظفين المتوسطين",
  "color": "#3498db",
  "minSalary": 5000,
  "maxSalary": 8000,
  "isActive": true
}
```

### تفاصيل درجة
```
GET /job-grades/:id
```

### تحديث درجة
```
PATCH /job-grades/:id
Body: (نفس حقول الإنشاء، كلها اختيارية)
```

### حذف درجة
```
DELETE /job-grades/:id
```

**الـ permissions المطلوبة:**
| العملية | Permission |
|---------|-----------|
| عرض | `job-grades:read` |
| إنشاء | `job-grades:create` |
| تعديل | `job-grades:update` |
| حذف | `job-grades:delete` |

---

## 5. الأقسام (Departments)

### قائمة الأقسام
```
GET /departments?page=1&limit=20&parentId=
```

### إنشاء قسم
```
POST /departments
```
```json
{
  "code": "IT",
  "nameAr": "قسم تقنية المعلومات",
  "nameEn": "Information Technology",
  "parentId": "uuid-or-null",
  "managerId": "uuid-or-null"
}
```

---

## 6. الطلبات الإدارية (Administrative Requests) - **[جديد كلياً]**

### أنواع الطلبات (RequestType)
| القيمة | المعنى |
|--------|--------|
| `TRANSFER` | طلب نقل |
| `PERMISSION` | طلب إذن |
| `ADVANCE` | طلب سلفة |
| `RESIGNATION` | طلب استقالة |
| `JOB_CHANGE` | طلب تغيير وظيفة |
| `RIGHTS` | طلب استحقاقات |
| `REWARD` | طلب مكافأة |
| `SPONSORSHIP` | طلب كفالة |
| `OTHER` | أخرى |

### حالات الطلب (RequestStatus)
```
DRAFT → PENDING_MANAGER → PENDING_HR → APPROVED
                       ↘              ↘
                        REJECTED       REJECTED
DRAFT → CANCELLED
PENDING_MANAGER → CANCELLED
```

---

### عرض جميع الطلبات (للمدير/HR)
```
GET /requests?page=1&limit=20&status=PENDING_MANAGER&type=PERMISSION&employeeId=
```
**يتطلب:** `requests:read`

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [{
      "id": "uuid",
      "requestNumber": "REQ-2026-000001",
      "employeeId": "uuid",
      "type": "PERMISSION",
      "status": "PENDING_MANAGER",
      "reason": "حاجة عائلية",
      "notes": "طلب إذن ليوم واحد",
      "attachmentUrl": null,
      "details": null,
      "managerStatus": null,
      "managerReviewedBy": null,
      "managerReviewedAt": null,
      "managerNotes": null,
      "hrStatus": null,
      "hrReviewedBy": null,
      "hrReviewedAt": null,
      "hrNotes": null,
      "cancelReason": null,
      "createdAt": "2026-02-28T10:00:00.000Z",
      "updatedAt": "2026-02-28T10:05:00.000Z",
      "history": []
    }],
    "total": 15
  }
}
```

### طلباتي (للموظف)
```
GET /requests/my?page=1&limit=20&status=
```
> لا يحتاج permissions خاصة، فقط JWT

### تفاصيل طلب
```
GET /requests/:id
```

### إنشاء طلب جديد (DRAFT)
```
POST /requests
```
```json
{
  "type": "PERMISSION",
  "reason": "حاجة عائلية طارئة",
  "notes": "أحتاج ليوم إجازة طارئة",
  "attachmentUrl": "https://storage.example.com/file.pdf",
  "details": { "fromDate": "2026-03-01", "toDate": "2026-03-01" }
}
```
> `details`: أي بيانات إضافية بصيغة JSON حسب نوع الطلب
> يُنشأ تلقائياً بحالة `DRAFT`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "requestNumber": "REQ-2026-000001",
    "status": "DRAFT",
    ...
  }
}
```

### تقديم الطلب (DRAFT → PENDING_MANAGER)
```
POST /requests/:id/submit
```
> لا يحتاج body

### إلغاء الطلب
```
POST /requests/:id/cancel
```
```json
{ "reason": "تم حل المشكلة" }
```
> يمكن إلغاء الطلب فقط إذا كانت حالته `DRAFT` أو `PENDING_MANAGER`

### موافقة المدير (PENDING_MANAGER → PENDING_HR)
```
POST /requests/:id/manager-approve
```
```json
{ "notes": "موافق على الطلب" }
```
**يتطلب:** `requests:manager-approve`

### رفض المدير (PENDING_MANAGER → REJECTED)
```
POST /requests/:id/manager-reject
```
```json
{ "notes": "سبب الرفض" }
```
**يتطلب:** `requests:manager-reject`

### موافقة HR (PENDING_HR → APPROVED)
```
POST /requests/:id/hr-approve
```
```json
{ "notes": "اعتماد HR" }
```
**يتطلب:** `requests:hr-approve`

### رفض HR (PENDING_HR → REJECTED)
```
POST /requests/:id/hr-reject
```
```json
{ "notes": "سبب رفض HR" }
```
**يتطلب:** `requests:hr-reject`

---

## 7. تقارير الحضور (Attendance Reports) - **[جديد كلياً]**

**جميع التقارير تتطلب:** `attendance.reports.read`

### التقرير اليومي
```
GET /attendance-reports/daily?date=2026-02-28&departmentId=&employeeId=
```
**Query Params:**
| المعامل | النوع | الوصف |
|---------|------|-------|
| `date` | string | التاريخ (YYYY-MM-DD) - الافتراضي: اليوم |
| `departmentId` | string (optional) | تصفية بالقسم |
| `employeeId` | string (optional) | تصفية بالموظف |

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-02-28",
    "totalRecords": 45,
    "statusSummary": {
      "PRESENT": 38,
      "LATE": 5,
      "ABSENT": 2
    },
    "records": [{
      "id": "uuid",
      "employeeId": "uuid",
      "date": "2026-02-28T00:00:00.000Z",
      "clockInTime": "2026-02-28T08:05:00.000Z",
      "clockOutTime": "2026-02-28T17:00:00.000Z",
      "workedMinutes": 535,
      "lateMinutes": 5,
      "status": "LATE",
      "employee": {
        "employeeNumber": "EMP000001",
        "firstNameAr": "أحمد",
        "lastNameAr": "محمد"
      }
    }]
  }
}
```

### التقرير الشهري
```
GET /attendance-reports/monthly?year=2026&month=2&employeeId=&departmentId=
```
**Query Params:**
| المعامل | النوع | الوصف |
|---------|------|-------|
| `year` | number | السنة - الافتراضي: السنة الحالية |
| `month` | number | الشهر (1-12) - الافتراضي: الشهر الحالي |
| `employeeId` | string (optional) | تصفية بموظف محدد |
| `departmentId` | string (optional) | تصفية بقسم محدد |

**Response:**
```json
{
  "success": true,
  "data": {
    "year": 2026,
    "month": 2,
    "totalEmployees": 45,
    "employees": [{
      "employee": {
        "id": "uuid",
        "employeeNumber": "EMP000001",
        "firstNameAr": "أحمد",
        "lastNameAr": "محمد"
      },
      "totalDays": 20,
      "presentDays": 18,
      "absentDays": 1,
      "lateDays": 3,
      "earlyLeaveDays": 1,
      "weekendDays": 8,
      "onLeaveDays": 1,
      "totalWorkedMinutes": 9600,
      "totalWorkedHours": 160.0,
      "totalOvertimeMinutes": 120,
      "totalOvertimeHours": 2.0,
      "totalLateMinutes": 45,
      "totalEarlyLeaveMinutes": 30
    }]
  }
}
```

### تقرير الملخص (لفترة زمنية)
```
GET /attendance-reports/summary?dateFrom=2026-02-01&dateTo=2026-02-28&employeeId=&departmentId=
```
**Query Params:**
| المعامل | النوع | الوصف |
|---------|------|-------|
| `dateFrom` | string | من تاريخ (YYYY-MM-DD) - الافتراضي: أول الشهر |
| `dateTo` | string | إلى تاريخ (YYYY-MM-DD) - الافتراضي: اليوم |
| `employeeId` | string (optional) | تصفية بموظف |
| `departmentId` | string (optional) | تصفية بقسم |

**Response:**
```json
{
  "success": true,
  "data": {
    "dateFrom": "2026-02-01",
    "dateTo": "2026-02-28",
    "totalEmployees": 45,
    "totals": {
      "totalRecords": 900,
      "presentDays": 780,
      "absentDays": 20,
      "lateDays": 65,
      "earlyLeaveDays": 30,
      "weekendDays": 160,
      "onLeaveDays": 50,
      "totalWorkedMinutes": 374400,
      "totalOvertimeMinutes": 3600,
      "totalLateMinutes": 1950,
      "totalEarlyLeaveMinutes": 900,
      "totalWorkedHours": 6240.0,
      "totalOvertimeHours": 60.0
    }
  }
}
```

### تقرير الاستراحات
```
GET /attendance-reports/breaks?dateFrom=2026-02-01&dateTo=2026-02-28&employeeId=&departmentId=
```
**Response:**
```json
{
  "success": true,
  "data": {
    "dateFrom": "2026-02-01",
    "dateTo": "2026-02-28",
    "totalRecords": 850,
    "totalBreakMinutes": 51000,
    "totalBreakHours": 850.0,
    "employees": [{
      "employee": { "employeeNumber": "EMP000001", "firstNameAr": "أحمد", ... },
      "totalDays": 20,
      "totalBreakMinutes": 1200,
      "avgBreakMinutesPerDay": 60.0,
      "records": [...]
    }]
  }
}
```

---

## 8. طلبات الإجازات (Leave Requests)

### الحالات
```
DRAFT → PENDING_MANAGER → PENDING_HR → APPROVED
                                     ↘ REJECTED
```

### قائمة الإجازات
```
GET /leave-requests?page=1&limit=20&status=&employeeId=&leaveTypeId=
```

### إنشاء طلب إجازة
```
POST /leave-requests
```
```json
{
  "leaveTypeId": "uuid",
  "startDate": "2026-03-01",
  "endDate": "2026-03-03",
  "reason": "إجازة سنوية"
}
```

### تقديم / موافقة / رفض
```
POST /leave-requests/:id/submit
POST /leave-requests/:id/manager-approve   Body: { "notes": "..." }
POST /leave-requests/:id/manager-reject    Body: { "notes": "..." }
POST /leave-requests/:id/hr-approve        Body: { "notes": "..." }
POST /leave-requests/:id/hr-reject         Body: { "notes": "..." }
POST /leave-requests/:id/cancel
```

---

## 9. سجلات الحضور (Attendance Records)

### تسجيل دخول
```
POST /attendance-records/check-in
```
```json
{
  "date": "2026-02-28",
  "checkInTime": "2026-02-28T08:00:00.000Z",
  "location": "{\"lat\": 24.7136, \"lng\": 46.6753}"
}
```

### تسجيل خروج
```
POST /attendance-records/check-out
```
```json
{
  "date": "2026-02-28",
  "checkOutTime": "2026-02-28T17:00:00.000Z"
}
```

### حضوري (للموظف)
```
GET /attendance-records/my-attendance?dateFrom=2026-02-01&dateTo=2026-02-28
```

### جميع السجلات (للمدير/HR)
```
GET /attendance-records?employeeId=&dateFrom=&dateTo=&status=LATE
```

---

## 10. جداول العمل (Work Schedules)

### قائمة جداول العمل
```
GET /work-schedules
```

### إنشاء جدول
```
POST /work-schedules
```
```json
{
  "code": "STANDARD",
  "nameAr": "الدوام الرسمي",
  "nameEn": "Standard Schedule",
  "workStartTime": "08:00",
  "workEndTime": "17:00",
  "breakStartTime": "12:00",
  "breakEndTime": "13:00",
  "workDays": "[0,1,2,3,4]",
  "lateToleranceMin": 15,
  "earlyLeaveToleranceMin": 15,
  "allowOvertime": false
}
```
> `workDays`: 0=الأحد، 1=الاثنين، ... 6=السبت

---

## 11. الـ Permissions الكاملة

| Module | Permissions |
|--------|------------|
| Users | `users:read`, `users:create`, `users:update`, `users:delete` |
| Employees | `employees:read`, `employees:create`, `employees:update`, `employees:delete` |
| Departments | `departments:read`, `departments:create`, `departments:update`, `departments:delete` |
| Roles | `roles:read`, `roles:create`, `roles:update`, `roles:delete` |
| Job Titles | `job-titles:read`, `job-titles:create`, `job-titles:update`, `job-titles:delete` |
| **Job Grades** | `job-grades:read`, `job-grades:create`, `job-grades:update`, `job-grades:delete` |
| Leave Types | `leave_types:read`, `leave_types:create`, `leave_types:update`, `leave_types:delete` |
| Leave Requests | `leave_requests:read`, `leave_requests:read_all`, `leave_requests:create` ... |
| Attendance Records | `attendance.records.read`, `attendance.records.create`, `attendance.records.check-in`, `attendance.records.check-out` |
| **Attendance Reports** | `attendance.reports.read` |
| **Requests** | `requests:read`, `requests:manager-approve`, `requests:manager-reject`, `requests:hr-approve`, `requests:hr-reject` |
| Evaluation | `evaluation:periods:read`, `evaluation:forms:view-all` ... |
