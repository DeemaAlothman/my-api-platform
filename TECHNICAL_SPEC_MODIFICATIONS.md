# المواصفات التقنية للتعديلات المطلوبة
## مشروع: My API Platform — نظام إدارة الموارد البشرية
**التاريخ:** 2026-02-26
**المرجع:** الملاحظات اليدوية (VitaXir) + تحليل الكود الحالي
**الإصدار:** 1.0

---

## فهرس التعديلات

| # | التعديل | الخدمة المتأثرة | الأولوية |
|---|---------|----------------|---------|
| 1 | إصلاح شجرة الأقسام لدعم عمق غير محدود | `users-service` | 🔴 عالية |
| 2 | إضافة درجات الوظائف (Job Grades) | `users-service` | 🔴 عالية |
| 3 | إضافة الراتب الأساسي للموظف | `users-service` | 🔴 عالية |
| 4 | إضافة وصف للمسمى الوظيفي | `users-service` | 🟡 متوسطة |
| 5 | بناء خدمة الطلبات الجديدة كاملةً | `requests-service` (جديدة) | 🔴 عالية |
| 6 | إضافة تقارير الحضور التلقائية | `attendance-service` | 🔴 عالية |
| 7 | إضافة تقرير الاستراحات | `attendance-service` | 🟡 متوسطة |
| 8 | تحديث Gateway للخدمة الجديدة | `gateway` | 🔴 عالية |
| 9 | تحديث docker-compose | `docker-compose.yml` | 🔴 عالية |

---

## قواعد عامة يجب الالتزام بها

> هذه القواعد مستخرجة من الكود الحالي ويجب أن تطبق على **كل** التعديلات.

### 1. هيكل الخدمة (NestJS)
```
apps/[service-name]/
├── src/
│   ├── [module]/
│   │   ├── dto/
│   │   │   ├── create-[entity].dto.ts
│   │   │   ├── update-[entity].dto.ts
│   │   │   └── list-[entity].query.dto.ts
│   │   ├── [entity].controller.ts
│   │   ├── [entity].module.ts
│   │   └── [entity].service.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/response.interceptor.ts
│   │   └── strategies/jwt.strategy.ts
│   ├── infrastructure/
│   │   └── filters/http-exception.filter.ts
│   ├── prisma/
│   │   └── prisma.service.ts
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma
├── Dockerfile
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### 2. تنسيق الاستجابة الموحد
```json
// نجاح
{ "success": true, "data": { ... }, "meta": { "timestamp": "..." } }

// خطأ
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": [] }, "meta": { ... } }
```

### 3. نمط الـ DTO
```typescript
// استخدام class-validator دائماً
import { IsString, IsOptional, IsEnum, IsUUID, IsNotEmpty } from 'class-validator';
```

### 4. Soft Delete
```typescript
// جميع الحذف يكون soft delete
await this.prisma.entity.update({ where: { id }, data: { deletedAt: new Date() } });
// وجميع queries تضيف: where: { deletedAt: null }
```

### 5. الصلاحيات (Permissions)
```typescript
// كل endpoint محمي بـ JWT + Permission
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permission('requests:read')  // نمط: module:action
```

### 6. معالجة الأخطاء
```typescript
throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: '...', details: [...] });
throw new ConflictException({ code: 'RESOURCE_ALREADY_EXISTS', message: '...', details: [...] });
throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '...', details: [...] });
```

---

---

# التعديل #1 — إصلاح شجرة الأقسام (Unlimited Depth Tree)

## الخدمة المتأثرة
`apps/users/src/departments/departments.service.ts`

## سبب التعديل
الكود الحالي في `getTree()` يجلب الأقسام بعمق **3 مستويات فقط** (root → children → grandchildren). الهيكل التنظيمي لـ VitaXir يحتاج **4 مستويات** كحد أدنى:
- المدير العام (مستوى 1)
- المدير التنفيذي (مستوى 2)
- مدير HR / الإنتاج / التجاري (مستوى 3)
- وظائف وتعيينات / رواتب / حضور (مستوى 4)

## المشكلة في الكود الحالي
```typescript
// departments.service.ts — السطر 39
children: {
  where: { deletedAt: null },
  // ← هنا يتوقف، لا يوجد مستوى رابع
},
```

## المطلوب: استبدال دالة `getTree()` بالكامل

### الملف: `apps/users/src/departments/departments.service.ts`

**استبدل الدالة `getTree()` من السطر 11 إلى 50 بالكود التالي:**

```typescript
async getTree() {
  // جلب كل الأقسام بدون حد عمق
  const allDepartments = await this.prisma.department.findMany({
    where: { deletedAt: null },
    include: {
      manager: {
        select: {
          id: true,
          employeeNumber: true,
          firstNameAr: true,
          lastNameAr: true,
          firstNameEn: true,
          lastNameEn: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  // بناء الشجرة بشكل recursive في الذاكرة
  const buildTree = (parentId: string | null): any[] => {
    return allDepartments
      .filter((d) => d.parentId === parentId)
      .map((d) => ({
        ...d,
        children: buildTree(d.id),
      }));
  };

  return buildTree(null);
}
```

**السبب:** بدلاً من nested Prisma includes (محدودة)، نجلب كل الأقسام دفعة واحدة ونبني الشجرة في الذاكرة — وهذا النهج يدعم عمقاً غير محدود ويعمل بكفاءة أعلى.

---

---

# التعديل #2 — إضافة درجات الوظائف (Job Grades)

## الخدمة المتأثرة
`apps/users/`

## سبب التعديل
الهيكل التنظيمي (ورقة VitaXir) يتضمن جدول درجات رواتب ملوّن في أسفل يمين الصفحة. يربط كل مسمى وظيفي بدرجة راتبية لتحديد نطاق الراتب. هذا مفقود كلياً من النظام الحالي.

## التعديلات المطلوبة

### 1. تعديل Prisma Schema

**الملف:** `apps/users/prisma/schema.prisma`

**أضف هذا النموذج بعد نموذج `JobTitle` (بعد السطر 154):**

```prisma
// درجات الوظائف وسلم الرواتب
model JobGrade {
  id           String   @id @default(uuid())
  code         String   @unique         // مثال: GR1, GR2, GR3
  nameAr       String                   // الدرجة الأولى
  nameEn       String?                  // Grade 1
  minSalary    Float?                   // الحد الأدنى للراتب
  maxSalary    Float?                   // الحد الأقصى للراتب
  description  String?                  // وصف الدرجة
  color        String?                  // اللون للعرض البصري (hex)
  isActive     Boolean  @default(true)

  employees    Employee[]
  jobTitles    JobTitle[]

  deletedAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("job_grades")
}
```

**عدّل نموذج `JobTitle` — أضف حقل `gradeId` (بعد السطر 153):**

```prisma
model JobTitle {
  id          String    @id @default(uuid())
  code        String    @unique
  nameAr      String
  nameEn      String?
  nameTr      String?
  description String?                // ← جديد: وصف المهام والمسؤوليات

  gradeId     String?               // ← جديد: ربط بالدرجة الوظيفية
  grade       JobGrade? @relation(fields: [gradeId], references: [id])

  employees   Employee[]

  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@map("job_titles")
}
```

**عدّل نموذج `Employee` — أضف حقل `jobGradeId` بعد `jobTitleId`:**

```prisma
  jobGradeId   String?
  jobGrade     JobGrade? @relation(fields: [jobGradeId], references: [id])
```

### 2. إنشاء Module جديد

**المسار:** `apps/users/src/job-grades/`

**الملفات المطلوبة:**

#### `apps/users/src/job-grades/dto/create-job-grade.dto.ts`
```typescript
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateJobGradeDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  nameAr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSalary?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
```

#### `apps/users/src/job-grades/dto/update-job-grade.dto.ts`
```typescript
// نفس CreateJobGradeDto لكن كل الحقول Optional (PartialType pattern)
import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class UpdateJobGradeDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsNumber() @Min(0) minSalary?: number;
  @IsOptional() @IsNumber() @Min(0) maxSalary?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
```

#### `apps/users/src/job-grades/job-grades.service.ts`

يجب أن يحتوي على الدوال التالية (بنفس نمط `DepartmentsService`):
- `list()` — قائمة مع pagination
- `findOne(id)` — جلب درجة واحدة مع موظفيها وعناوينها الوظيفية
- `create(dto)` — إنشاء مع التحقق من تكرار code
- `update(id, dto)` — تعديل مع التحقق
- `remove(id)` — soft delete + منع الحذف لو فيه موظفين مرتبطين

#### `apps/users/src/job-grades/job-grades.controller.ts`

**Endpoints:**

| Method | Path | Permission | الوصف |
|--------|------|-----------|-------|
| GET | `/job-grades` | `job-grades:read` | قائمة الدرجات |
| GET | `/job-grades/:id` | `job-grades:read` | درجة واحدة |
| POST | `/job-grades` | `job-grades:create` | إنشاء درجة |
| PATCH | `/job-grades/:id` | `job-grades:update` | تعديل درجة |
| DELETE | `/job-grades/:id` | `job-grades:delete` | حذف ناعم |

#### `apps/users/src/job-grades/job-grades.module.ts`
```typescript
@Module({
  controllers: [JobGradesController],
  providers: [JobGradesService, PrismaService],
})
export class JobGradesModule {}
```

### 3. تسجيل Module في AppModule

**الملف:** `apps/users/src/app.module.ts`

أضف `JobGradesModule` في الـ imports:
```typescript
import { JobGradesModule } from './job-grades/job-grades.module';
// ...
imports: [
  // ... الموجودة
  JobGradesModule,
],
```

### 4. Permissions المطلوبة

أضف هذه الصلاحيات في seed البيانات:
```
job-grades:read
job-grades:create
job-grades:update
job-grades:delete
```

### 5. Migration

```bash
npx prisma migrate dev --name add_job_grades
```

---

---

# التعديل #3 — إضافة الراتب الأساسي للموظف

## الخدمة المتأثرة
`apps/users/`

## سبب التعديل
لا يوجد حقل راتب في جدول `employees`. الهيكل التنظيمي يتضمن درجات رواتب وهذا يعني أن كل موظف يجب أن يكون له راتب أساسي.

## التعديلات المطلوبة

### 1. تعديل Prisma Schema

**الملف:** `apps/users/prisma/schema.prisma`

**في نموذج `Employee`، أضف الحقول التالية بعد `fingerprintId`:**

```prisma
  // بيانات الراتب
  basicSalary      Float?               // الراتب الأساسي
  salarycurrency   String? @default("SYP")  // عملة الراتب
```

### 2. تعديل DTO

**الملف:** `apps/users/src/employees/dto/create-employee.dto.ts`

أضف في نهاية الـ DTO:
```typescript
@IsOptional()
@IsNumber()
@Min(0)
basicSalary?: number;

@IsOptional()
@IsString()
salaryCurrency?: string;
```

**الملف:** `apps/users/src/employees/dto/update-employee.dto.ts`

أضف نفس الحقلين بنفس الـ decorators.

### 3. تعديل Service

**الملف:** `apps/users/src/employees/employees.service.ts`

- دالة `create()`: الحقلان يُمرران تلقائياً مع `...dto` — لا تغيير إضافي.
- دالة `update()`: نفس الشيء.
- دالة `list()` و `findOne()`: لا تغيير، ستظهر الحقول تلقائياً في الاستجابة.

### 4. Migration

```bash
npx prisma migrate dev --name add_employee_salary
```

---

---

# التعديل #4 — إضافة وصف للمسمى الوظيفي

## الخدمة المتأثرة
`apps/users/`

## سبب التعديل
جدول `job_titles` يحتوي فقط على الاسم. الهيكل التنظيمي يتضمن منصبات بمهام محددة تحتاج وصفاً.

## التعديلات المطلوبة

### 1. Prisma Schema
تم تغطيته في التعديل #2 (تمت إضافة `description` و `gradeId` لـ `JobTitle`).

### 2. تعديل DTOs لـ JobTitle

**الملف:** أنشئ ملف جديد أو ابحث عن DTO الموجودة لـ job_titles وأضف:
```typescript
@IsOptional()
@IsString()
description?: string;

@IsOptional()
@IsUUID()
gradeId?: string;
```

### 3. تعديل Service لـ JobTitle

في دوال `findOne()` و `list()`، أضف الـ include لـ grade:
```typescript
include: {
  grade: {
    select: { id: true, code: true, nameAr: true, nameEn: true, minSalary: true, maxSalary: true }
  },
  _count: { select: { employees: true } }
}
```

---

---

# التعديل #5 — خدمة الطلبات (Requests Service) — خدمة جديدة

## معلومات الخدمة
- **المسار:** `apps/requests/`
- **البورت:** `4006`
- **قاعدة البيانات Schema:** `requests`
- **النمط:** نفس بنية `apps/leave/` تماماً

## سبب الإنشاء
الورقة الثانية تحدد **9 أنواع طلبات** جديدة غير مشمولة في أي خدمة حالية، مع مسار موافقة موحد (مدير مباشر → HR).

---

## 5.1 — قاعدة البيانات (Prisma Schema)

**الملف:** `apps/requests/prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["requests"]
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

// ============================
// أنواع الطلبات
// ============================
enum RequestType {
  TRANSFER          // نقل من قسم إلى قسم
  PERMISSION        // إذن إداري (خروج مؤقت)
  ADVANCE           // سلفة راتب
  RESIGNATION       // استقالة
  JOB_CHANGE        // طلب تغيير وظيفة
  RIGHTS            // طلب حقوق وظيفية
  REWARD            // طلب مكافأة
  SPONSORSHIP       // طلب كفالة
  OTHER             // أخرى
}

// حالة الطلب الرئيسية
enum RequestStatus {
  DRAFT             // مسودة - لم يُرسل بعد
  PENDING_MANAGER   // بانتظار موافقة المدير المباشر
  PENDING_HR        // بانتظار موافقة HR
  APPROVED          // موافق عليه
  REJECTED          // مرفوض
  CANCELLED         // ملغى من الموظف
}

// حالة الموافقة الفردية
enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

// ============================
// الطلبات الرئيسية
// ============================
model Request {
  id              String        @id @default(uuid())
  requestNumber   String        @unique  // رقم الطلب - يُولَّد تلقائياً مثل REQ-2026-000001
  employeeId      String                 // مرجع لـ users.employees
  type            RequestType
  status          RequestStatus @default(DRAFT)
  reason          String?                // سبب الطلب
  notes           String?                // ملاحظات إضافية من الموظف
  attachmentUrl   String?                // رابط مرفق (اختياري)

  // بيانات خاصة بكل نوع (JSON مرن)
  details         Json?                  // بيانات تفصيلية حسب نوع الطلب

  // موافقة المدير المباشر
  managerStatus    ApprovalStatus?
  managerReviewedBy String?              // employeeId للمدير
  managerReviewedAt DateTime?
  managerNotes      String?

  // موافقة HR
  hrStatus         ApprovalStatus?
  hrReviewedBy     String?              // employeeId لـ HR
  hrReviewedAt     DateTime?
  hrNotes          String?

  // الإلغاء
  cancelReason     String?
  cancelledAt      DateTime?
  cancelledBy      String?

  history          RequestHistory[]

  deletedAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([employeeId])
  @@index([type])
  @@index([status])
  @@index([requestNumber])
  @@map("requests")
  @@schema("requests")
}

// ============================
// سجل تاريخ الطلب (Audit Log)
// ============================
model RequestHistory {
  id          String   @id @default(uuid())
  requestId   String
  action      String   // SUBMITTED, MANAGER_APPROVED, MANAGER_REJECTED, HR_APPROVED, ...
  fromStatus  String?
  toStatus    String
  performedBy String   // employeeId أو userId
  notes       String?
  createdAt   DateTime @default(now())

  request     Request  @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([requestId])
  @@map("request_history")
  @@schema("requests")
}
```

---

## 5.2 — هيكل الملفات

```
apps/requests/
├── src/
│   ├── requests/
│   │   ├── dto/
│   │   │   ├── create-request.dto.ts
│   │   │   ├── update-request.dto.ts
│   │   │   ├── list-requests.query.dto.ts
│   │   │   ├── approve-request.dto.ts
│   │   │   └── reject-request.dto.ts
│   │   ├── requests.controller.ts
│   │   ├── requests.module.ts
│   │   └── requests.service.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts  ← نسخ من users-service
│   │   │   └── permission.decorator.ts    ← نسخ من users-service
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts          ← نسخ من users-service
│   │   │   └── permissions.guard.ts       ← نسخ من users-service
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts    ← نسخ من users-service
│   │   └── strategies/
│   │       └── jwt.strategy.ts            ← نسخ من users-service
│   ├── infrastructure/
│   │   └── filters/
│   │       └── http-exception.filter.ts   ← نسخ من users-service
│   ├── prisma/
│   │   └── prisma.service.ts              ← نسخ من users-service
│   ├── app.module.ts
│   └── main.ts                            ← port: 4006
├── prisma/
│   └── schema.prisma
├── Dockerfile                             ← نسخ من apps/leave/Dockerfile وعدّل اسم الخدمة
├── nest-cli.json
├── package.json
└── tsconfig.json
```

---

## 5.3 — DTOs

### `create-request.dto.ts`
```typescript
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { RequestType } from '@prisma/client';

export class CreateRequestDto {
  @IsNotEmpty()
  @IsEnum(RequestType)
  type: RequestType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  // بيانات تفصيلية حسب نوع الطلب (موضحة أدناه)
  @IsOptional()
  details?: Record<string, any>;
}
```

### `approve-request.dto.ts`
```typescript
import { IsOptional, IsString } from 'class-validator';

export class ApproveRequestDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
```

### `reject-request.dto.ts`
```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectRequestDto {
  @IsNotEmpty()
  @IsString()
  notes: string; // السبب إلزامي عند الرفض
}
```

### `list-requests.query.dto.ts`
```typescript
import { IsEnum, IsOptional, IsNumberString } from 'class-validator';
import { RequestType, RequestStatus } from '@prisma/client';

export class ListRequestsQueryDto {
  @IsOptional() @IsNumberString() page?: number;
  @IsOptional() @IsNumberString() limit?: number;
  @IsOptional() @IsEnum(RequestType) type?: RequestType;
  @IsOptional() @IsEnum(RequestStatus) status?: RequestStatus;
  @IsOptional() employeeId?: string;
}
```

---

## 5.4 — حقل `details` حسب نوع الطلب

> حقل `details` هو JSON مرن — البيانات التالية هي ما يُتوقع فيه لكل نوع:

| نوع الطلب | حقول details المتوقعة |
|-----------|----------------------|
| `TRANSFER` | `fromDepartmentId`, `toDepartmentId`, `transferDate`, `reason` |
| `PERMISSION` | `date`, `fromTime`, `toTime`, `durationHours`, `reason` |
| `ADVANCE` | `amount`, `currency`, `repaymentMonths`, `reason` |
| `RESIGNATION` | `resignationDate`, `lastWorkingDay`, `reason`, `handoverPlan` |
| `JOB_CHANGE` | `currentJobTitleId`, `requestedJobTitleId`, `reason` |
| `RIGHTS` | `rightType` (مثل: OVERTIME_PAY, BONUS, ALLOWANCE), `description`, `amount?` |
| `REWARD` | `reason`, `requestedAmount?`, `period?` |
| `SPONSORSHIP` | `sponsoredPersonName`, `relation`, `purpose` |
| `OTHER` | `description` |

---

## 5.5 — منطق الخدمة (requests.service.ts)

### الدوال المطلوبة:

#### `create(dto, employeeId)`
```
1. توليد requestNumber: 'REQ-' + سنة + '-' + رقم تسلسلي بـ 6 خانات
2. إنشاء الطلب بـ status: DRAFT
3. إرجاع الطلب المنشأ
```

#### `submit(id, employeeId)`
```
1. التحقق من أن الطلب موجود والموظف هو صاحبه
2. التحقق من أن الحالة DRAFT
3. تغيير status → PENDING_MANAGER
4. إضافة سجل في RequestHistory: action='SUBMITTED'
5. إرجاع الطلب المحدّث
```

#### `managerApprove(id, managerEmployeeId, dto: ApproveRequestDto)`
```
1. التحقق من أن الطلب بحالة PENDING_MANAGER
2. تحديث: managerStatus=APPROVED, managerReviewedBy, managerReviewedAt, managerNotes
3. تغيير status → PENDING_HR
4. إضافة سجل: action='MANAGER_APPROVED'
```

#### `managerReject(id, managerEmployeeId, dto: RejectRequestDto)`
```
1. التحقق من أن الطلب بحالة PENDING_MANAGER
2. تحديث: managerStatus=REJECTED
3. تغيير status → REJECTED
4. إضافة سجل: action='MANAGER_REJECTED'
```

#### `hrApprove(id, hrEmployeeId, dto: ApproveRequestDto)`
```
1. التحقق من أن الطلب بحالة PENDING_HR
2. تحديث: hrStatus=APPROVED, hrReviewedBy, hrReviewedAt, hrNotes
3. تغيير status → APPROVED
4. إضافة سجل: action='HR_APPROVED'
```

#### `hrReject(id, hrEmployeeId, dto: RejectRequestDto)`
```
1. التحقق من أن الطلب بحالة PENDING_HR
2. تحديث: hrStatus=REJECTED
3. تغيير status → REJECTED
4. إضافة سجل: action='HR_REJECTED'
```

#### `cancel(id, employeeId, reason)`
```
1. التحقق من أن الموظف هو صاحب الطلب
2. التحقق من أن الحالة DRAFT أو PENDING_MANAGER فقط (لا يمكن إلغاء بعد وصول HR)
3. تغيير status → CANCELLED
4. حفظ cancelReason وcancelledAt وcancelledBy
5. إضافة سجل: action='CANCELLED'
```

#### `list(query)`
```
- Pagination: page, limit
- Filters: type, status, employeeId
- Include: history آخر 5 سجلات
```

#### `findOne(id)`
```
- Include: history كاملة مرتبة desc
```

---

## 5.6 — Controller Endpoints

**Base URL:** `POST /api/v1/requests`

| Method | Path | Permission | الوصف |
|--------|------|-----------|-------|
| GET | `/requests` | `requests:read` | قائمة الطلبات (فلتر بحالة ونوع) |
| GET | `/requests/my` | JWT فقط | طلباتي أنا |
| GET | `/requests/:id` | `requests:read` | طلب واحد بالتفاصيل والتاريخ |
| POST | `/requests` | JWT فقط | إنشاء طلب جديد (DRAFT) |
| POST | `/requests/:id/submit` | JWT فقط | تقديم الطلب للمدير |
| POST | `/requests/:id/cancel` | JWT فقط | إلغاء الطلب |
| POST | `/requests/:id/manager-approve` | `requests:manager-approve` | موافقة المدير |
| POST | `/requests/:id/manager-reject` | `requests:manager-reject` | رفض المدير |
| POST | `/requests/:id/hr-approve` | `requests:hr-approve` | موافقة HR |
| POST | `/requests/:id/hr-reject` | `requests:hr-reject` | رفض HR |

---

## 5.7 — `main.ts` للخدمة الجديدة

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './infrastructure/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(4006);
}
bootstrap();
```

---

## 5.8 — `app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { RequestsModule } from './requests/requests.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
      signOptions: { expiresIn: '15m' },
    }),
    RequestsModule,
  ],
  providers: [PrismaService, JwtStrategy],
})
export class AppModule {}
```

---

## 5.9 — Permissions المطلوبة (seed)

```
requests:read
requests:create
requests:manager-approve
requests:manager-reject
requests:hr-approve
requests:hr-reject
```

---

## 5.10 — Migration

```bash
# من داخل مجلد apps/requests
npx prisma migrate dev --name init_requests_schema
```

---

---

# التعديل #6 — تقارير الحضور التلقائية

## الخدمة المتأثرة
`apps/attendance/`

## سبب التعديل
الورقة الثانية أشارت بدائرة إلى **"تقارير الاستراحة والبيانات"** و**"تقارير حضور تلقائي"**. البيانات موجودة في قاعدة البيانات لكن لا يوجد أي API للتقارير.

---

## 6.1 — إنشاء Reports Module

**المسار:** `apps/attendance/src/reports/`

### الملفات المطلوبة:

#### `apps/attendance/src/reports/dto/attendance-report.query.dto.ts`

```typescript
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';

export enum ReportType {
  DAILY    = 'DAILY',
  WEEKLY   = 'WEEKLY',
  MONTHLY  = 'MONTHLY',
  CUSTOM   = 'CUSTOM',
}

export class AttendanceReportQueryDto {
  @IsNotEmpty()
  @IsEnum(ReportType)
  type: ReportType;

  @IsOptional()
  @IsDateString()
  startDate?: string;   // مطلوب عند type=CUSTOM

  @IsOptional()
  @IsDateString()
  endDate?: string;     // مطلوب عند type=CUSTOM

  @IsOptional()
  @IsString()
  employeeId?: string;  // إذا فارغ → كل الموظفين

  @IsOptional()
  @IsString()
  departmentId?: string; // فلتر بالقسم

  @IsOptional()
  year?: number;         // للتقرير الشهري

  @IsOptional()
  month?: number;        // 1-12 للتقرير الشهري
}
```

#### `apps/attendance/src/reports/reports.service.ts`

**الدوال المطلوبة:**

##### `getAttendanceSummary(query)`
```
يُرجع ملخصاً لكل موظف خلال الفترة المحددة:
- totalWorkingDays: أيام العمل المقررة
- presentDays: أيام الحضور
- absentDays: أيام الغياب
- lateDays: أيام التأخير
- earlyLeaveDays: أيام الخروج المبكر
- totalWorkedHours: إجمالي ساعات العمل
- totalOvertimeHours: إجمالي الأوفرتايم
- totalLateMinutes: إجمالي دقائق التأخير
- attendanceRate: نسبة الحضور (%)

Query المطلوب:
  prisma.attendanceRecord.groupBy بـ employeeId
  مع WHERE: date BETWEEN startDate AND endDate
```

##### `getDailyReport(date)`
```
تقرير يومي لكل الموظفين في يوم محدد:
- قائمة بكل موظف + حالته (حاضر/غائب/متأخر/إذن)
- إجماليات: عدد الحاضرين، الغائبين، المتأخرين
```

##### `getBreakReport(query)`
```
تقرير الاستراحات:
يُرجع لكل موظف/يوم:
- breakStartTime (clockOut للاستراحة)
- breakEndTime (clockIn من الاستراحة)
- actualBreakMinutes: مدة الاستراحة الفعلية
- scheduledBreakMinutes: مدة الاستراحة المقررة
- breakOvertime: الزيادة عن المقرر (إذا وجدت)

ملاحظة: يُحسب من حقل breakMinutes في AttendanceRecord
```

##### `getMonthlyReport(year, month, employeeId?)`
```
تقرير شهري مفصّل:
- كل أيام الشهر مع حالة كل يوم
- إجماليات نهاية الشهر
- مقارنة مع الشهر السابق (اختياري)
```

#### `apps/attendance/src/reports/reports.controller.ts`

**Endpoints:**

| Method | Path | Permission | الوصف |
|--------|------|-----------|-------|
| GET | `/attendance-reports/summary` | `attendance:read` | ملخص الحضور لفترة |
| GET | `/attendance-reports/daily` | `attendance:read` | تقرير يومي |
| GET | `/attendance-reports/monthly` | `attendance:read` | تقرير شهري |
| GET | `/attendance-reports/breaks` | `attendance:read` | تقرير الاستراحات |

#### `apps/attendance/src/reports/reports.module.ts`

```typescript
@Module({
  controllers: [ReportsController],
  providers: [ReportsService, PrismaService],
})
export class ReportsModule {}
```

---

## 6.2 — تسجيل في AppModule

**الملف:** `apps/attendance/src/app.module.ts`

أضف `ReportsModule` في imports (بنفس طريقة باقي الـ modules).

---

---

# التعديل #7 — تحديث API Gateway

## الملفات المتأثرة
- `apps/gateway/src/proxy/proxy.service.ts`
- `apps/gateway/src/proxy/proxy.controller.ts`
- `apps/gateway/src/proxy/proxy.module.ts`

---

## 7.1 — `proxy.service.ts`

أضف خدمة requests في constructor:
```typescript
this.services.set('requests', {
  url: process.env.REQUESTS_SERVICE_URL || 'http://localhost:4006',
  prefix: '/requests',
});
```

---

## 7.2 — `proxy.controller.ts`

أضف هذه الـ Controllers في نهاية الملف:

```typescript
// ============================
// Requests Service Proxy
// ============================
@Controller('requests')
export class RequestsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'requests');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'requests');
  }
}

// ============================
// Attendance Reports Proxy
// ============================
@Controller('attendance-reports')
export class AttendanceReportsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

// ============================
// Job Grades Proxy
// ============================
@Controller('job-grades')
export class JobGradesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}
```

---

## 7.3 — `proxy.module.ts`

أضف Controllers الجديدة في الـ controllers array:
```typescript
controllers: [
  // ... الموجودة
  RequestsProxyController,
  AttendanceReportsProxyController,
  JobGradesProxyController,
],
```

---

---

# التعديل #8 — تحديث docker-compose.yml

## الملف المتأثر
`docker-compose.yml` (الجذر)

## التعديل المطلوب

### أضف خدمة `requests` بعد خدمة `evaluation`:

```yaml
  requests:
    build:
      context: .
      dockerfile: apps/requests/Dockerfile
    container_name: myapiplatform-requests
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/platform?schema=requests
      JWT_ACCESS_SECRET: your-jwt-secret-change-in-production
      NODE_ENV: production
    ports:
      - "4006:4006"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network
```

### عدّل خدمة `gateway` — أضف في environment وفي depends_on:

```yaml
  gateway:
    environment:
      # ... الموجودة
      REQUESTS_SERVICE_URL: http://requests:4006
    depends_on:
      - auth
      - users
      - leave
      - attendance
      - evaluation
      - requests    # ← جديد
```

---

---

# التعديل #9 — Dockerfile للخدمة الجديدة

## الملف
`apps/requests/Dockerfile`

**انسخ `apps/leave/Dockerfile` بالكامل** وعدّل:
- كل `leave` → `requests`
- Port من `4003` → `4006`

**النمط الكامل:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/requests/ ./apps/requests/
RUN npm install --legacy-peer-deps
WORKDIR /app/apps/requests
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/requests/ ./apps/requests/
RUN npm install --omit=dev --legacy-peer-deps
WORKDIR /app/apps/requests
RUN npx prisma generate
COPY --from=builder /app/apps/requests/dist ./dist
EXPOSE 4006
CMD ["node", "dist/main.js"]
```

---

---

# ملخص Permissions الكاملة الجديدة

> يجب إضافتها في seed البيانات في `apps/users/prisma/seed.ts` أو ملف الـ seed المناظر.

```typescript
// درجات الوظائف — module: 'job-grades'
{ name: 'job-grades:read',   displayName: 'عرض درجات الوظائف',   module: 'job-grades' },
{ name: 'job-grades:create', displayName: 'إنشاء درجة وظيفة',    module: 'job-grades' },
{ name: 'job-grades:update', displayName: 'تعديل درجة وظيفة',    module: 'job-grades' },
{ name: 'job-grades:delete', displayName: 'حذف درجة وظيفة',      module: 'job-grades' },

// الطلبات — module: 'requests'
{ name: 'requests:read',            displayName: 'عرض الطلبات',               module: 'requests' },
{ name: 'requests:manager-approve', displayName: 'موافقة المدير على الطلب',   module: 'requests' },
{ name: 'requests:manager-reject',  displayName: 'رفض المدير للطلب',          module: 'requests' },
{ name: 'requests:hr-approve',      displayName: 'موافقة HR على الطلب',       module: 'requests' },
{ name: 'requests:hr-reject',       displayName: 'رفض HR للطلب',              module: 'requests' },

// تقارير الحضور — module: 'attendance'  (يُضاف للـ permissions الموجودة)
{ name: 'attendance:reports',       displayName: 'عرض تقارير الحضور',         module: 'attendance' },
```

---

---

# جدول التنفيذ المقترح

| المرحلة | التعديلات | الترتيب |
|---------|-----------|---------|
| **المرحلة 1** | التعديل #1 (شجرة الأقسام) + التعديل #3 (راتب الموظف) | يُنجز أولاً — بدون migration معقد |
| **المرحلة 2** | التعديل #2 (Job Grades) + التعديل #4 (وصف المسمى) | يتبع مباشرة — migration واحدة |
| **المرحلة 3** | التعديل #5 (خدمة الطلبات كاملة) | المهمة الأكبر — تحتاج وقتاً |
| **المرحلة 4** | التعديل #6 + #7 (تقارير الحضور) | مستقلة — يمكن بالتوازي مع المرحلة 3 |
| **المرحلة 5** | التعديل #8 + #9 (Docker + Gateway) | آخر خطوة بعد اكتمال الكود |

---

# اختبار التعديلات

## Seed البيانات التجريبية (للاختبار)

### درجات الوظائف:
```json
[
  { "code": "GR1", "nameAr": "الدرجة الأولى",   "minSalary": 500000, "maxSalary": 800000,  "color": "#27ae60" },
  { "code": "GR2", "nameAr": "الدرجة الثانية",  "minSalary": 350000, "maxSalary": 500000,  "color": "#f39c12" },
  { "code": "GR3", "nameAr": "الدرجة الثالثة",  "minSalary": 200000, "maxSalary": 350000,  "color": "#e74c3c" },
  { "code": "GR4", "nameAr": "الدرجة الرابعة",  "minSalary": 100000, "maxSalary": 200000,  "color": "#95a5a6" }
]
```

### أنواع الطلبات للاختبار:
```json
[
  { "type": "PERMISSION", "details": { "date": "2026-03-01", "fromTime": "10:00", "toTime": "12:00", "durationHours": 2, "reason": "مراجعة طبية" } },
  { "type": "ADVANCE",    "details": { "amount": 100000, "currency": "SYP", "repaymentMonths": 3, "reason": "ظروف طارئة" } },
  { "type": "TRANSFER",   "details": { "fromDepartmentId": "uuid", "toDepartmentId": "uuid", "transferDate": "2026-04-01" } }
]
```

---

# ملاحظات للمطوّر

1. **لا تمس الملفات الموجودة** إلا التعديلات المحددة فقط (التعديل #1، #2، #3، #4).
2. **خدمة الطلبات** خدمة مستقلة تماماً — لا ترتبط بكود الخدمات الأخرى.
3. **JWT Strategy** في كل خدمة جديدة يجب أن تكون **نسخة مطابقة** من `apps/users/src/common/strategies/jwt.strategy.ts`.
4. **الـ schema** في `DATABASE_URL` لخدمة الطلبات يجب أن يكون `requests` (مختلف عن باقي الخدمات).
5. **لا تستخدم** `@nestjs/config` في الخدمات الجديدة للحفاظ على الاتساق مع البنية الحالية (باستثناء `evaluation-service` التي تستخدمها).
6. **عند إضافة Permissions الجديدة** — أضفها في ملف seed الموجود في `apps/users/prisma/` وليس بطريقة أخرى.
7. **الـ Migration** لكل خدمة يجب تشغيله من داخل مجلد الخدمة مباشرة.
