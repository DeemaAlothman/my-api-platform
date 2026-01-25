# دليل واجهة البرمجة التطبيقية (API Documentation)

## معلومات عامة

**Base URL**: `http://your-domain.com:8000/api/v1` (عبر Gateway)
**الإصدار**: v1.0
**التوثيق**: JWT Bearer Token

---

## 📋 جدول المحتويات

1. [المصادقة (Authentication)](#1-authentication)
2. [إدارة المستخدمين (Users)](#2-users)
3. [إدارة الموظفين (Employees)](#3-employees)
4. [إدارة الأقسام (Departments)](#4-departments)
5. [إدارة الأدوار (Roles)](#5-roles)
6. [إدارة الإجازات (Leave Management)](#6-leave-management)
7. [إدارة الحضور والانصراف (Attendance)](#7-attendance)
8. [إدارة التقييمات (Evaluation)](#8-evaluation)

---

## الاستجابة القياسية (Standard Response Format)

جميع الـ endpoints تُرجع استجابة بالتنسيق التالي:

### نجاح (Success)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-25T10:00:00.000Z",
    "page": 1,
    "limit": 10,
    "total": 100
  }
}
```

### خطأ (Error)
```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "رسالة الخطأ بالعربية",
  "details": [],
  "timestamp": "2026-01-25T10:00:00.000Z",
  "path": "/api/v1/..."
}
```

---

## التوثيق (Authentication)

جميع الطلبات (ما عدا تسجيل الدخول) تحتاج إلى Bearer Token في الـ headers:

```http
Authorization: Bearer <access_token>
```

---

## 1. Authentication

### 1.1 تسجيل الدخول (Login)

**Endpoint**: `POST /auth/login`
**الصلاحيات المطلوبة**: لا يوجد

**Request Body**:
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@wso.org",
      "fullName": "مدير النظام",
      "roles": ["super_admin"],
      "permissions": [
        "users:read",
        "users:create",
        "..."
      ]
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  },
  "meta": {
    "timestamp": "2026-01-25T10:00:00.000Z"
  }
}
```

**Curl Example**:
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

---

### 1.2 تحديث التوكن (Refresh Token)

**Endpoint**: `POST /auth/refresh`
**الصلاحيات المطلوبة**: لا يوجد

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": 900
  }
}
```

---

### 1.3 تسجيل الخروج (Logout)

**Endpoint**: `POST /auth/logout`
**الصلاحيات المطلوبة**: أي مستخدم مُسجل دخول

**Headers**:
```http
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

---

## 2. Users

### 2.1 الحصول على جميع المستخدمين (Get All Users)

**Endpoint**: `GET /users`
**الصلاحيات المطلوبة**: `users:read`

**Query Parameters**:
- `page` (optional): رقم الصفحة (default: 1)
- `limit` (optional): عدد النتائج (default: 10)
- `search` (optional): البحث في الاسم أو البريد

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "admin",
      "email": "admin@wso.org",
      "fullName": "مدير النظام",
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5
  }
}
```

**Curl Example**:
```bash
curl -X GET "http://localhost:8000/api/v1/users?page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

---

### 2.2 الحصول على مستخدم واحد (Get User by ID)

**Endpoint**: `GET /users/:id`
**الصلاحيات المطلوبة**: `users:read`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@wso.org",
    "fullName": "جون دو",
    "isActive": true,
    "roles": [
      {
        "id": "uuid",
        "name": "employee",
        "nameAr": "موظف"
      }
    ]
  }
}
```

---

### 2.3 إنشاء مستخدم جديد (Create User)

**Endpoint**: `POST /users`
**الصلاحيات المطلوبة**: `users:create`

**Request Body**:
```json
{
  "username": "new_user",
  "email": "newuser@wso.org",
  "fullName": "مستخدم جديد",
  "password": "SecurePassword123!",
  "isActive": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "username": "new_user",
    "email": "newuser@wso.org",
    "fullName": "مستخدم جديد",
    "isActive": true,
    "createdAt": "2026-01-25T10:00:00.000Z"
  }
}
```

**Curl Example**:
```bash
curl -X POST http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "new_user",
    "email": "newuser@wso.org",
    "fullName": "مستخدم جديد",
    "password": "SecurePassword123!",
    "isActive": true
  }'
```

---

### 2.4 تحديث مستخدم (Update User)

**Endpoint**: `PATCH /users/:id`
**الصلاحيات المطلوبة**: `users:update`

**Request Body**:
```json
{
  "fullName": "الاسم المحدث",
  "email": "updated@wso.org",
  "isActive": false
}
```

---

### 2.5 حذف مستخدم (Delete User)

**Endpoint**: `DELETE /users/:id`
**الصلاحيات المطلوبة**: `users:delete`

**Response**:
```json
{
  "success": true,
  "message": "تم حذف المستخدم بنجاح"
}
```

---

### 2.6 تعيين أدوار للمستخدم (Assign Roles)

**Endpoint**: `POST /users/:id/roles`
**الصلاحيات المطلوبة**: `users:assign_roles`

**Request Body**:
```json
{
  "roleIds": ["role-uuid-1", "role-uuid-2"]
}
```

---

## 3. Employees

### 3.1 الحصول على جميع الموظفين (Get All Employees)

**Endpoint**: `GET /employees`
**الصلاحيات المطلوبة**: `employees:read`

**Query Parameters**:
- `page` (optional): رقم الصفحة
- `limit` (optional): عدد النتائج
- `departmentId` (optional): تصفية حسب القسم
- `search` (optional): البحث في الاسم أو رقم الموظف

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employeeCode": "EMP001",
      "firstName": "أحمد",
      "lastName": "محمد",
      "firstNameEn": "Ahmed",
      "lastNameEn": "Mohammed",
      "nationalId": "1234567890",
      "email": "ahmed@wso.org",
      "phone": "0501234567",
      "jobTitle": "مطور برمجيات",
      "jobTitleEn": "Software Developer",
      "department": {
        "id": "dept-uuid",
        "nameAr": "قسم تقنية المعلومات",
        "nameEn": "IT Department"
      },
      "manager": {
        "id": "manager-uuid",
        "firstName": "خالد",
        "lastName": "علي"
      },
      "hireDate": "2024-01-01",
      "isActive": true
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50
  }
}
```

**Curl Example**:
```bash
curl -X GET "http://localhost:8000/api/v1/employees?page=1&limit=10&departmentId=dept-uuid" \
  -H "Authorization: Bearer <token>"
```

---

### 3.2 إنشاء موظف جديد (Create Employee)

**Endpoint**: `POST /employees`
**الصلاحيات المطلوبة**: `employees:create`

**Request Body**:
```json
{
  "employeeCode": "EMP002",
  "firstName": "محمد",
  "lastName": "أحمد",
  "firstNameEn": "Mohammed",
  "lastNameEn": "Ahmed",
  "nationalId": "0987654321",
  "email": "mohammed@wso.org",
  "phone": "0559876543",
  "jobTitle": "مصمم جرافيك",
  "jobTitleEn": "Graphic Designer",
  "departmentId": "dept-uuid",
  "managerId": "manager-uuid",
  "hireDate": "2026-02-01",
  "isActive": true
}
```

---

### 3.3 تحديث موظف (Update Employee)

**Endpoint**: `PATCH /employees/:id`
**الصلاحيات المطلوبة**: `employees:update`

**Request Body**:
```json
{
  "jobTitle": "مطور أول",
  "jobTitleEn": "Senior Developer",
  "phone": "0501111111"
}
```

---

### 3.4 حذف موظف (Delete Employee)

**Endpoint**: `DELETE /employees/:id`
**الصلاحيات المطلوبة**: `employees:delete`

---

## 4. Departments

### 4.1 الحصول على جميع الأقسام (Get All Departments)

**Endpoint**: `GET /departments`
**الصلاحيات المطلوبة**: `departments:read`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "IT",
      "nameAr": "قسم تقنية المعلومات",
      "nameEn": "IT Department",
      "description": "قسم مسؤول عن جميع أنظمة تقنية المعلومات",
      "isActive": true,
      "employeeCount": 15
    }
  ]
}
```

---

### 4.2 إنشاء قسم جديد (Create Department)

**Endpoint**: `POST /departments`
**الصلاحيات المطلوبة**: `departments:create`

**Request Body**:
```json
{
  "code": "HR",
  "nameAr": "قسم الموارد البشرية",
  "nameEn": "Human Resources Department",
  "description": "قسم مسؤول عن إدارة شؤون الموظفين",
  "isActive": true
}
```

---

### 4.3 تحديث قسم (Update Department)

**Endpoint**: `PATCH /departments/:id`
**الصلاحيات المطلوبة**: `departments:update`

---

### 4.4 حذف قسم (Delete Department)

**Endpoint**: `DELETE /departments/:id`
**الصلاحيات المطلوبة**: `departments:delete`

---

## 5. Roles

### 5.1 الحصول على جميع الأدوار (Get All Roles)

**Endpoint**: `GET /roles`
**الصلاحيات المطلوبة**: `roles:read`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "super_admin",
      "nameAr": "مدير النظام",
      "description": "صلاحيات كاملة لإدارة النظام",
      "permissions": [
        {
          "id": "perm-uuid",
          "code": "users:read",
          "nameAr": "قراءة المستخدمين",
          "category": "Users"
        }
      ]
    }
  ]
}
```

---

### 5.2 إنشاء دور جديد (Create Role)

**Endpoint**: `POST /roles`
**الصلاحيات المطلوبة**: `roles:create`

**Request Body**:
```json
{
  "name": "manager",
  "nameAr": "مدير",
  "description": "صلاحيات المدير",
  "permissionIds": ["perm-uuid-1", "perm-uuid-2"]
}
```

---

### 5.3 تحديث دور (Update Role)

**Endpoint**: `PATCH /roles/:id`
**الصلاحيات المطلوبة**: `roles:update`

---

## 6. Leave Management

### 6.1 أنواع الإجازات (Leave Types)

#### 6.1.1 الحصول على جميع أنواع الإجازات
**Endpoint**: `GET /leave-types`
**الصلاحيات المطلوبة**: `leave_types:read`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "ANNUAL",
      "nameAr": "إجازة سنوية",
      "nameEn": "Annual Leave",
      "defaultDays": 30,
      "requiresApproval": true,
      "maxConsecutiveDays": 30,
      "allowHalfDay": true,
      "allowCarryOver": true,
      "maxCarryOverDays": 10,
      "isActive": true
    }
  ]
}
```

**Curl Example**:
```bash
curl -X GET http://localhost:8000/api/v1/leave-types \
  -H "Authorization: Bearer <token>"
```

---

#### 6.1.2 إنشاء نوع إجازة جديد
**Endpoint**: `POST /leave-types`
**الصلاحيات المطلوبة**: `leave_types:create`

**Request Body**:
```json
{
  "code": "SICK",
  "nameAr": "إجازة مرضية",
  "nameEn": "Sick Leave",
  "defaultDays": 15,
  "requiresApproval": true,
  "maxConsecutiveDays": 7,
  "allowHalfDay": false,
  "allowCarryOver": false,
  "isActive": true
}
```

---

### 6.2 طلبات الإجازات (Leave Requests)

#### 6.2.1 الحصول على طلبات الإجازة الخاصة بي
**Endpoint**: `GET /leave-requests/my`
**الصلاحيات المطلوبة**: `leave_requests:read`

**Query Parameters**:
- `status` (optional): PENDING, APPROVED_BY_MANAGER, APPROVED_BY_HR, REJECTED, CANCELLED
- `leaveTypeId` (optional): تصفية حسب نوع الإجازة
- `year` (optional): تصفية حسب السنة

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employee": {
        "id": "emp-uuid",
        "firstName": "أحمد",
        "lastName": "محمد"
      },
      "leaveType": {
        "id": "type-uuid",
        "code": "ANNUAL",
        "nameAr": "إجازة سنوية"
      },
      "startDate": "2026-03-01",
      "endDate": "2026-03-10",
      "totalDays": 10,
      "reason": "إجازة عائلية",
      "status": "PENDING",
      "submittedAt": "2026-02-15T10:00:00.000Z",
      "managerApprovedAt": null,
      "hrApprovedAt": null
    }
  ]
}
```

---

#### 6.2.2 الحصول على جميع طلبات الإجازات (للمديرين / HR)
**Endpoint**: `GET /leave-requests`
**الصلاحيات المطلوبة**: `leave_requests:read_all`

**Query Parameters**:
- `status`: PENDING, APPROVED_BY_MANAGER, APPROVED_BY_HR, REJECTED
- `employeeId`: تصفية حسب الموظف
- `departmentId`: تصفية حسب القسم
- `page`: رقم الصفحة
- `limit`: عدد النتائج

---

#### 6.2.3 إنشاء طلب إجازة جديد
**Endpoint**: `POST /leave-requests`
**الصلاحيات المطلوبة**: `leave_requests:create`

**Request Body**:
```json
{
  "leaveTypeId": "type-uuid",
  "startDate": "2026-04-01",
  "endDate": "2026-04-05",
  "reason": "إجازة شخصية",
  "isHalfDay": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "new-request-uuid",
    "employeeId": "emp-uuid",
    "leaveTypeId": "type-uuid",
    "startDate": "2026-04-01",
    "endDate": "2026-04-05",
    "totalDays": 5,
    "status": "PENDING",
    "reason": "إجازة شخصية",
    "submittedAt": "2026-03-20T10:00:00.000Z"
  }
}
```

**Curl Example**:
```bash
curl -X POST http://localhost:8000/api/v1/leave-requests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "leaveTypeId": "type-uuid",
    "startDate": "2026-04-01",
    "endDate": "2026-04-05",
    "reason": "إجازة شخصية",
    "isHalfDay": false
  }'
```

---

#### 6.2.4 الموافقة على طلب إجازة (مدير)
**Endpoint**: `POST /leave-requests/:id/approve-manager`
**الصلاحيات المطلوبة**: `leave_requests:approve_manager`

**Request Body**:
```json
{
  "notes": "تمت الموافقة"
}
```

---

#### 6.2.5 الموافقة على طلب إجازة (HR)
**Endpoint**: `POST /leave-requests/:id/approve-hr`
**الصلاحيات المطلوبة**: `leave_requests:approve_hr`

**Request Body**:
```json
{
  "notes": "تمت الموافقة النهائية"
}
```

---

#### 6.2.6 رفض طلب إجازة
**Endpoint**: `POST /leave-requests/:id/reject`
**الصلاحيات المطلوبة**: `leave_requests:approve_manager` أو `leave_requests:approve_hr`

**Request Body**:
```json
{
  "notes": "سبب الرفض"
}
```

---

#### 6.2.7 إلغاء طلب إجازة
**Endpoint**: `POST /leave-requests/:id/cancel`
**الصلاحيات المطلوبة**: `leave_requests:cancel`

---

### 6.3 أرصدة الإجازات (Leave Balances)

#### 6.3.1 الحصول على رصيد إجازاتي
**Endpoint**: `GET /leave-balances/my`
**الصلاحيات المطلوبة**: `leave_balances:read`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "leaveType": {
        "id": "type-uuid",
        "code": "ANNUAL",
        "nameAr": "إجازة سنوية"
      },
      "year": 2026,
      "totalDays": 30,
      "usedDays": 5,
      "remainingDays": 25,
      "carriedOverDays": 0
    }
  ]
}
```

---

#### 6.3.2 الحصول على أرصدة موظف محدد
**Endpoint**: `GET /leave-balances/employee/:employeeId`
**الصلاحيات المطلوبة**: `leave_balances:read_all`

---

#### 6.3.3 تعديل رصيد إجازة
**Endpoint**: `POST /leave-balances/:id/adjust`
**الصلاحيات المطلوبة**: `leave_balances:adjust`

**Request Body**:
```json
{
  "adjustmentDays": 5,
  "reason": "تعويض عن عمل إضافي"
}
```

---

### 6.4 العطلات الرسمية (Holidays)

#### 6.4.1 الحصول على جميع العطلات
**Endpoint**: `GET /holidays`
**الصلاحيات المطلوبة**: `holidays:read`

**Query Parameters**:
- `year`: السنة (required)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nameAr": "عيد الفطر",
      "nameEn": "Eid Al-Fitr",
      "date": "2026-04-01",
      "isRecurring": true
    }
  ]
}
```

---

#### 6.4.2 إنشاء عطلة رسمية
**Endpoint**: `POST /holidays`
**الصلاحيات المطلوبة**: `holidays:create`

**Request Body**:
```json
{
  "nameAr": "اليوم الوطني",
  "nameEn": "National Day",
  "date": "2026-09-23",
  "isRecurring": true
}
```

---

## 7. Attendance

### 7.1 جداول العمل (Work Schedules)

#### 7.1.1 الحصول على جميع جداول العمل
**Endpoint**: `GET /work-schedules`
**الصلاحيات المطلوبة**: `attendance.work-schedules.read`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "STANDARD",
      "nameAr": "الدوام الرسمي",
      "nameEn": "Standard Working Hours",
      "workStartTime": "08:00",
      "workEndTime": "17:00",
      "breakStartTime": "12:00",
      "breakEndTime": "13:00",
      "breakDurationMin": 60,
      "workDays": "[0,1,2,3,4]",
      "lateToleranceMin": 15,
      "earlyLeaveToleranceMin": 15,
      "allowOvertime": true,
      "maxOvertimeHours": 4.0,
      "isDefault": true,
      "isActive": true
    }
  ]
}
```

**Curl Example**:
```bash
curl -X GET http://localhost:8000/api/v1/work-schedules \
  -H "Authorization: Bearer <token>"
```

---

#### 7.1.2 إنشاء جدول عمل جديد
**Endpoint**: `POST /work-schedules`
**الصلاحيات المطلوبة**: `attendance.work-schedules.create`

**Request Body**:
```json
{
  "code": "SHIFT_A",
  "nameAr": "وردية A",
  "nameEn": "Shift A",
  "workStartTime": "06:00",
  "workEndTime": "14:00",
  "breakStartTime": "10:00",
  "breakEndTime": "10:30",
  "breakDurationMin": 30,
  "workDays": "[0,1,2,3,4,5,6]",
  "lateToleranceMin": 10,
  "earlyLeaveToleranceMin": 10,
  "allowOvertime": true,
  "maxOvertimeHours": 2.0,
  "isActive": true,
  "description": "وردية صباحية"
}
```

---

#### 7.1.3 تحديث جدول عمل
**Endpoint**: `PATCH /work-schedules/:id`
**الصلاحيات المطلوبة**: `attendance.work-schedules.update`

---

#### 7.1.4 حذف جدول عمل
**Endpoint**: `DELETE /work-schedules/:id`
**الصلاحيات المطلوبة**: `attendance.work-schedules.delete`

---

### 7.2 سجلات الحضور (Attendance Records)

#### 7.2.1 تسجيل الحضور (Clock In)
**Endpoint**: `POST /attendance-records/clock-in`
**الصلاحيات المطلوبة**: `attendance.records.check-in`

**Request Body** (optional):
```json
{
  "location": "المكتب الرئيسي",
  "notes": "وصلت في الوقت المحدد"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "employeeId": "emp-uuid",
    "date": "2026-01-25",
    "clockInTime": "2026-01-25T08:05:00.000Z",
    "status": "PRESENT",
    "isLate": true,
    "lateMinutes": 5
  }
}
```

**Curl Example**:
```bash
curl -X POST http://localhost:8000/api/v1/attendance-records/clock-in \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "المكتب الرئيسي"
  }'
```

---

#### 7.2.2 تسجيل الانصراف (Clock Out)
**Endpoint**: `POST /attendance-records/clock-out`
**الصلاحيات المطلوبة**: `attendance.records.check-out`

**Request Body** (optional):
```json
{
  "location": "المكتب الرئيسي",
  "notes": "انتهى الدوام"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "employeeId": "emp-uuid",
    "date": "2026-01-25",
    "clockInTime": "2026-01-25T08:05:00.000Z",
    "clockOutTime": "2026-01-25T17:10:00.000Z",
    "totalWorkMinutes": 545,
    "overtimeMinutes": 10,
    "status": "PRESENT"
  }
}
```

---

#### 7.2.3 الحصول على حضوري اليوم
**Endpoint**: `GET /attendance-records/my/today`
**الصلاحيات المطلوبة**: `attendance.records.read-own`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "date": "2026-01-25",
    "clockInTime": "2026-01-25T08:05:00.000Z",
    "clockOutTime": null,
    "status": "PRESENT",
    "isLate": true,
    "lateMinutes": 5,
    "workSchedule": {
      "workStartTime": "08:00",
      "workEndTime": "17:00"
    }
  }
}
```

**Curl Example**:
```bash
curl -X GET http://localhost:8000/api/v1/attendance-records/my/today \
  -H "Authorization: Bearer <token>"
```

---

#### 7.2.4 الحصول على سجلات حضوري
**Endpoint**: `GET /attendance-records/my`
**الصلاحيات المطلوبة**: `attendance.records.read-own`

**Query Parameters**:
- `startDate`: تاريخ البداية (YYYY-MM-DD)
- `endDate`: تاريخ النهاية (YYYY-MM-DD)
- `status`: PRESENT, ABSENT, LATE, EARLY_LEAVE
- `page`: رقم الصفحة
- `limit`: عدد النتائج

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "date": "2026-01-24",
      "clockInTime": "2026-01-24T08:00:00.000Z",
      "clockOutTime": "2026-01-24T17:00:00.000Z",
      "status": "PRESENT",
      "isLate": false,
      "totalWorkMinutes": 540
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 20
  }
}
```

---

#### 7.2.5 الحصول على جميع سجلات الحضور (للإدارة)
**Endpoint**: `GET /attendance-records`
**الصلاحيات المطلوبة**: `attendance.records.read`

**Query Parameters**:
- `employeeId`: معرف الموظف
- `departmentId`: معرف القسم
- `startDate`: تاريخ البداية
- `endDate`: تاريخ النهاية
- `status`: حالة الحضور
- `page`: رقم الصفحة
- `limit`: عدد النتائج

---

#### 7.2.6 إدخال حضور يدوي (للإدارة)
**Endpoint**: `POST /attendance-records/manual`
**الصلاحيات المطلوبة**: `attendance.records.create`

**Request Body**:
```json
{
  "employeeId": "emp-uuid",
  "date": "2026-01-25",
  "clockInTime": "08:00",
  "clockOutTime": "17:00",
  "status": "PRESENT",
  "notes": "إدخال يدوي - نسي تسجيل الحضور"
}
```

---

### 7.3 تنبيهات الحضور (Attendance Alerts)

#### 7.3.1 الحصول على تنبيهاتي
**Endpoint**: `GET /attendance-alerts/my`
**الصلاحيات المطلوبة**: `attendance.alerts.read-own`

**Query Parameters**:
- `alertType`: LATE, ABSENT, EARLY_LEAVE, MISSING_CLOCK_OUT, CONSECUTIVE_ABSENCE
- `status`: OPEN, ACKNOWLEDGED, RESOLVED, DISMISSED
- `page`: رقم الصفحة
- `limit`: عدد النتائج

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employeeId": "emp-uuid",
      "date": "2026-01-25",
      "alertType": "LATE",
      "severity": "LOW",
      "message": "تأخر عن موعد الحضور",
      "messageAr": "تأخرت 15 دقيقة عن موعد الحضور",
      "status": "OPEN",
      "createdAt": "2026-01-25T08:15:00.000Z"
    }
  ]
}
```

---

#### 7.3.2 الحصول على جميع التنبيهات (للإدارة)
**Endpoint**: `GET /attendance-alerts`
**الصلاحيات المطلوبة**: `attendance.alerts.read`

**Query Parameters**:
- `employeeId`: معرف الموظف
- `departmentId`: معرف القسم
- `alertType`: نوع التنبيه
- `severity`: LOW, MEDIUM, HIGH, CRITICAL
- `status`: حالة التنبيه
- `startDate`: تاريخ البداية
- `endDate`: تاريخ النهاية

---

#### 7.3.3 حل تنبيه
**Endpoint**: `POST /attendance-alerts/:id/resolve`
**الصلاحيات المطلوبة**: `attendance.alerts.resolve`

**Request Body**:
```json
{
  "notes": "تم التنبيه على الموظف"
}
```

---

## 8. Evaluation

### 8.1 فترات التقييم (Evaluation Periods)

#### 8.1.1 الحصول على جميع فترات التقييم
**Endpoint**: `GET /evaluation-periods`
**الصلاحيات المطلوبة**: `evaluation:periods:read`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "2025-Q1",
      "nameAr": "تقييم الربع الأول 2025",
      "nameEn": "Q1 2025 Evaluation",
      "startDate": "2025-01-01",
      "endDate": "2025-03-31",
      "selfEvalDeadline": "2025-04-07",
      "managerEvalDeadline": "2025-04-14",
      "hrReviewDeadline": "2025-04-21",
      "gmApprovalDeadline": "2025-04-28",
      "status": "ACTIVE",
      "isActive": true
    }
  ]
}
```

**Curl Example**:
```bash
curl -X GET http://localhost:8000/api/v1/evaluation-periods \
  -H "Authorization: Bearer <token>"
```

---

#### 8.1.2 إنشاء فترة تقييم جديدة
**Endpoint**: `POST /evaluation-periods`
**الصلاحيات المطلوبة**: `evaluation:periods:create`

**Request Body**:
```json
{
  "code": "2026-Q2",
  "nameAr": "تقييم الربع الثاني 2026",
  "nameEn": "Q2 2026 Evaluation",
  "startDate": "2026-04-01",
  "endDate": "2026-06-30",
  "selfEvalDeadline": "2026-07-07",
  "managerEvalDeadline": "2026-07-14",
  "hrReviewDeadline": "2026-07-21",
  "gmApprovalDeadline": "2026-07-28",
  "status": "ACTIVE"
}
```

---

#### 8.1.3 تحديث فترة تقييم
**Endpoint**: `PATCH /evaluation-periods/:id`
**الصلاحيات المطلوبة**: `evaluation:periods:update`

---

#### 8.1.4 حذف فترة تقييم
**Endpoint**: `DELETE /evaluation-periods/:id`
**الصلاحيات المطلوبة**: `evaluation:periods:delete`

---

#### 8.1.5 إنشاء نماذج تقييم لفترة
**Endpoint**: `POST /evaluation-periods/:id/generate-forms`
**الصلاحيات المطلوبة**: `evaluation:periods:manage`

**Request Body** (optional):
```json
{
  "departmentIds": ["dept-uuid-1", "dept-uuid-2"],
  "employeeIds": ["emp-uuid-1", "emp-uuid-2"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalForms": 50,
    "message": "تم إنشاء 50 نموذج تقييم بنجاح"
  }
}
```

---

### 8.2 معايير التقييم (Evaluation Criteria)

#### 8.2.1 الحصول على جميع معايير التقييم
**Endpoint**: `GET /evaluation-criteria`
**الصلاحيات المطلوبة**: `evaluation:criteria:read`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "QUALITY",
      "nameAr": "جودة العمل",
      "nameEn": "Work Quality",
      "descriptionAr": "مستوى الدقة والإتقان في إنجاز المهام",
      "category": "PERFORMANCE",
      "weight": 20,
      "minScore": 1,
      "maxScore": 5,
      "sortOrder": 1,
      "isActive": true
    }
  ]
}
```

---

#### 8.2.2 إنشاء معيار تقييم جديد
**Endpoint**: `POST /evaluation-criteria`
**الصلاحيات المطلوبة**: `evaluation:criteria:create`

**Request Body**:
```json
{
  "code": "TEAMWORK",
  "nameAr": "العمل الجماعي",
  "nameEn": "Teamwork",
  "descriptionAr": "القدرة على العمل ضمن فريق",
  "category": "BEHAVIOR",
  "weight": 15,
  "minScore": 1,
  "maxScore": 5,
  "sortOrder": 5
}
```

---

### 8.3 نماذج التقييم (Evaluation Forms)

#### 8.3.1 الحصول على نماذج التقييم الخاصة بي
**Endpoint**: `GET /evaluation-forms/my`
**الصلاحيات المطلوبة**: `evaluation:forms:view-own`

**Query Parameters**:
- `periodId`: معرف الفترة
- `status`: PENDING_SELF, PENDING_MANAGER, PENDING_HR, PENDING_GM, COMPLETED

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "period": {
        "id": "period-uuid",
        "code": "2026-Q1",
        "nameAr": "تقييم الربع الأول 2026"
      },
      "employee": {
        "id": "emp-uuid",
        "firstName": "أحمد",
        "lastName": "محمد",
        "jobTitle": "مطور برمجيات"
      },
      "status": "PENDING_SELF",
      "selfEvaluatedAt": null,
      "managerEvaluatedAt": null,
      "hrReviewedAt": null,
      "gmApprovedAt": null,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

**Curl Example**:
```bash
curl -X GET "http://localhost:8000/api/v1/evaluation-forms/my?periodId=period-uuid" \
  -H "Authorization: Bearer <token>"
```

---

#### 8.3.2 الحصول على جميع نماذج التقييم (للإدارة)
**Endpoint**: `GET /evaluation-forms`
**الصلاحيات المطلوبة**: `evaluation:forms:view-all`

**Query Parameters**:
- `periodId`: معرف الفترة
- `departmentId`: معرف القسم
- `employeeId`: معرف الموظف
- `status`: حالة النموذج
- `page`: رقم الصفحة
- `limit`: عدد النتائج

---

#### 8.3.3 الحصول على نموذج تقييم محدد
**Endpoint**: `GET /evaluation-forms/:id`
**الصلاحيات المطلوبة**: `evaluation:forms:view-own` أو `evaluation:forms:view-all`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "period": { "code": "2026-Q1", "nameAr": "..." },
    "employee": { "firstName": "أحمد", "lastName": "محمد" },
    "status": "COMPLETED",
    "selfEvaluations": [
      {
        "criteriaId": "criteria-uuid",
        "criteriaCode": "QUALITY",
        "criteriaNameAr": "جودة العمل",
        "selfScore": 4,
        "selfComments": "أنجزت جميع المهام بدقة عالية"
      }
    ],
    "managerEvaluations": [
      {
        "criteriaId": "criteria-uuid",
        "criteriaCode": "QUALITY",
        "managerScore": 5,
        "managerComments": "أداء ممتاز"
      }
    ],
    "finalScore": 4.5,
    "finalGrade": "A",
    "hrNotes": "موظف متميز",
    "gmNotes": "يستحق الترقية"
  }
}
```

---

#### 8.3.4 تقييم ذاتي (Self Evaluation)
**Endpoint**: `POST /evaluation-forms/:id/self-evaluate`
**الصلاحيات المطلوبة**: `evaluation:forms:self-evaluate`

**Request Body**:
```json
{
  "evaluations": [
    {
      "criteriaId": "criteria-uuid-1",
      "score": 4,
      "comments": "أنجزت المهام بدقة عالية"
    },
    {
      "criteriaId": "criteria-uuid-2",
      "score": 5,
      "comments": "التزمت بجميع المواعيد"
    }
  ],
  "selfNotes": "ملاحظات عامة عن الأداء"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "form-uuid",
    "status": "PENDING_MANAGER",
    "selfEvaluatedAt": "2026-04-05T10:00:00.000Z",
    "message": "تم إرسال التقييم الذاتي بنجاح"
  }
}
```

**Curl Example**:
```bash
curl -X POST http://localhost:8000/api/v1/evaluation-forms/form-uuid/self-evaluate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluations": [
      {
        "criteriaId": "criteria-uuid-1",
        "score": 4,
        "comments": "أنجزت المهام بدقة عالية"
      }
    ],
    "selfNotes": "ملاحظات عامة"
  }'
```

---

#### 8.3.5 تقييم المدير (Manager Evaluation)
**Endpoint**: `POST /evaluation-forms/:id/manager-evaluate`
**الصلاحيات المطلوبة**: `evaluation:forms:manager-evaluate`

**Request Body**:
```json
{
  "evaluations": [
    {
      "criteriaId": "criteria-uuid-1",
      "score": 5,
      "comments": "أداء ممتاز وفوق المتوقع"
    }
  ],
  "managerNotes": "موظف متميز يستحق التقدير"
}
```

---

#### 8.3.6 مراجعة الموارد البشرية (HR Review)
**Endpoint**: `POST /evaluation-forms/:id/hr-review`
**الصلاحيات المطلوبة**: `evaluation:forms:hr-review`

**Request Body**:
```json
{
  "hrNotes": "تمت المراجعة - جميع البيانات صحيحة",
  "recommendPromotion": true,
  "recommendBonus": true
}
```

---

#### 8.3.7 اعتماد المدير العام (GM Approval)
**Endpoint**: `POST /evaluation-forms/:id/gm-approve`
**الصلاحيات المطلوبة**: `evaluation:forms:gm-approval`

**Request Body**:
```json
{
  "gmNotes": "معتمد - يستحق الترقية",
  "finalGrade": "A"
}
```

---

### 8.4 تقييمات الزملاء (Peer Evaluations)

#### 8.4.1 الحصول على تقييمات الزملاء لنموذج
**Endpoint**: `GET /peer-evaluations/forms/:formId/peers`
**الصلاحيات المطلوبة**: `evaluation:forms:view-all`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "evaluatorId": "emp-uuid",
      "evaluatorName": "خالد أحمد",
      "score": 4,
      "comments": "زميل متعاون",
      "submittedAt": "2026-04-10T10:00:00.000Z"
    }
  ]
}
```

---

#### 8.4.2 إضافة تقييم زميل
**Endpoint**: `POST /peer-evaluations/forms/:formId/peer`
**الصلاحيات المطلوبة**: `evaluation:peer:submit`

**Request Body**:
```json
{
  "score": 4,
  "comments": "زميل متميز ومتعاون"
}
```

---

### 8.5 أهداف الموظفين (Employee Goals)

#### 8.5.1 الحصول على أهداف نموذج تقييم
**Endpoint**: `GET /employee-goals/forms/:formId`
**الصلاحيات المطلوبة**: `evaluation:goals:manage`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "تحسين مهارات البرمجة",
      "description": "إكمال دورتين في البرمجة",
      "targetDate": "2026-06-30",
      "status": "IN_PROGRESS",
      "progress": 50,
      "notes": "أكملت دورة واحدة"
    }
  ]
}
```

---

#### 8.5.2 إضافة هدف جديد
**Endpoint**: `POST /employee-goals/forms/:formId`
**الصلاحيات المطلوبة**: `evaluation:goals:manage`

**Request Body**:
```json
{
  "title": "تطوير مهارات القيادة",
  "description": "حضور دورة تدريبية في القيادة",
  "targetDate": "2026-12-31",
  "priority": "HIGH"
}
```

---

#### 8.5.3 تحديث هدف
**Endpoint**: `PATCH /employee-goals/:id`
**الصلاحيات المطلوبة**: `evaluation:goals:manage`

**Request Body**:
```json
{
  "status": "COMPLETED",
  "progress": 100,
  "notes": "تم إكمال الهدف بنجاح"
}
```

---

#### 8.5.4 حذف هدف
**Endpoint**: `DELETE /employee-goals/:id`
**الصلاحيات المطلوبة**: `evaluation:goals:manage`

---

## أكواد الأخطاء الشائعة (Common Error Codes)

| الكود | الوصف |
|------|-------|
| `AUTH_INVALID_CREDENTIALS` | اسم مستخدم أو كلمة مرور خاطئة |
| `AUTH_TOKEN_INVALID` | التوكن غير صالح أو منتهي |
| `AUTH_INSUFFICIENT_PERMISSIONS` | لا تملك الصلاحيات الكافية |
| `VALIDATION_ERROR` | خطأ في البيانات المدخلة |
| `NOT_FOUND` | المورد المطلوب غير موجود |
| `DUPLICATE_ENTRY` | البيانات مكررة (username, email, code) |
| `INTERNAL_ERROR` | خطأ داخلي في الخادم |
| `LEAVE_BALANCE_INSUFFICIENT` | رصيد الإجازات غير كافٍ |
| `LEAVE_REQUEST_OVERLAP` | تعارض مع طلب إجازة آخر |
| `ATTENDANCE_ALREADY_CHECKED_IN` | تم تسجيل الحضور مسبقاً |
| `ATTENDANCE_NOT_CHECKED_IN` | لم يتم تسجيل الحضور بعد |
| `EVALUATION_DEADLINE_PASSED` | انتهى الموعد النهائي للتقييم |
| `EVALUATION_ALREADY_SUBMITTED` | تم إرسال التقييم مسبقاً |

---

## ملاحظات مهمة (Important Notes)

### التوكن (Token)
- **Access Token**: صالح لمدة 15 دقيقة (900 ثانية)
- **Refresh Token**: صالح لمدة 30 يوم
- استخدم `/auth/refresh` لتجديد الـ access token

### التواريخ (Dates)
- جميع التواريخ بصيغة ISO 8601: `YYYY-MM-DD` أو `YYYY-MM-DDTHH:mm:ss.sssZ`
- المنطقة الزمنية: UTC

### الصفحات (Pagination)
- الافتراضي: `page=1, limit=10`
- الحد الأقصى للـ limit: 100

### البحث (Search)
- البحث يدعم العربية والإنجليزية
- غير حساس لحالة الأحرف (case-insensitive)

### الترتيب (Sorting)
- الافتراضي: تنازلي حسب تاريخ الإنشاء
- يمكن التحكم بالترتيب عبر query parameter `sort`

---

## أمثلة شاملة (Complete Examples)

### مثال 1: سير عمل طلب إجازة كامل

```bash
# 1. تسجيل الدخول
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"employee1","password":"password123"}' \
  | jq -r '.data.accessToken')

# 2. التحقق من رصيد الإجازات
curl -X GET http://localhost:8000/api/v1/leave-balances/my \
  -H "Authorization: Bearer $TOKEN"

# 3. إنشاء طلب إجازة
LEAVE_REQUEST_ID=$(curl -s -X POST http://localhost:8000/api/v1/leave-requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leaveTypeId": "type-uuid",
    "startDate": "2026-05-01",
    "endDate": "2026-05-05",
    "reason": "إجازة عائلية"
  }' | jq -r '.data.id')

# 4. المدير يوافق على الطلب
curl -X POST http://localhost:8000/api/v1/leave-requests/$LEAVE_REQUEST_ID/approve-manager \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"موافق"}'

# 5. HR يوافق على الطلب
curl -X POST http://localhost:8000/api/v1/leave-requests/$LEAVE_REQUEST_ID/approve-hr \
  -H "Authorization: Bearer $HR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"تمت الموافقة النهائية"}'
```

---

### مثال 2: سير عمل الحضور اليومي

```bash
# 1. تسجيل الحضور صباحاً
curl -X POST http://localhost:8000/api/v1/attendance-records/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location":"المكتب الرئيسي"}'

# 2. التحقق من حالة الحضور اليوم
curl -X GET http://localhost:8000/api/v1/attendance-records/my/today \
  -H "Authorization: Bearer $TOKEN"

# 3. تسجيل الانصراف مساءً
curl -X POST http://localhost:8000/api/v1/attendance-records/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location":"المكتب الرئيسي"}'

# 4. عرض سجلات الحضور للشهر الحالي
curl -X GET "http://localhost:8000/api/v1/attendance-records/my?startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

### مثال 3: سير عمل التقييم الكامل

```bash
# 1. الحصول على نماذج التقييم الخاصة بي
curl -X GET http://localhost:8000/api/v1/evaluation-forms/my \
  -H "Authorization: Bearer $TOKEN"

# 2. إجراء التقييم الذاتي
curl -X POST http://localhost:8000/api/v1/evaluation-forms/$FORM_ID/self-evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluations": [
      {"criteriaId":"crit-1","score":4,"comments":"جيد جداً"},
      {"criteriaId":"crit-2","score":5,"comments":"ممتاز"}
    ],
    "selfNotes":"أداء جيد هذا الربع"
  }'

# 3. المدير يقيم الموظف
curl -X POST http://localhost:8000/api/v1/evaluation-forms/$FORM_ID/manager-evaluate \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluations": [
      {"criteriaId":"crit-1","score":5,"comments":"ممتاز"},
      {"criteriaId":"crit-2","score":5,"comments":"متميز"}
    ],
    "managerNotes":"موظف متميز"
  }'

# 4. HR يراجع التقييم
curl -X POST http://localhost:8000/api/v1/evaluation-forms/$FORM_ID/hr-review \
  -H "Authorization: Bearer $HR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hrNotes":"تمت المراجعة",
    "recommendPromotion":true,
    "recommendBonus":true
  }'

# 5. المدير العام يعتمد التقييم
curl -X POST http://localhost:8000/api/v1/evaluation-forms/$FORM_ID/gm-approve \
  -H "Authorization: Bearer $GM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gmNotes":"معتمد - يستحق الترقية",
    "finalGrade":"A"
  }'
```

---

## معلومات الاتصال والدعم

للحصول على المساعدة أو الإبلاغ عن مشاكل:
- **البريد الإلكتروني**: support@wso.org
- **الوثائق الفنية**: docs.wso.org
- **تحديث الوثائق**: 2026-01-25

---

**ملاحظة**: هذا الدليل يُحدَّث باستمرار. تأكد من استخدام أحدث إصدار.
