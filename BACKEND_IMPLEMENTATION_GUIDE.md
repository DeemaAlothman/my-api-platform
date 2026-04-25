# دليل تنفيذ تطوير نظام الطلبات — للمطور الباك اند

## الوضع الحالي

### خدمة الطلبات (`apps/requests/`)
- **بورت:** 4006
- **سكيما:** `requests`
- **أنواع الطلبات الحالية:** TRANSFER, PERMISSION, ADVANCE, RESIGNATION, JOB_CHANGE, RIGHTS, REWARD, SPONSORSHIP, OTHER
- **مراحل الموافقة:** مرحلتين فقط (مدير → HR)
- **الحقول المخصصة:** حقل `details` من نوع JSON حر بدون أي تحقق

### خدمة الإجازات (`apps/leave/`)
- **بورت:** 4003
- **سكيما:** `leaves`
- **تعمل بشكل مستقل** عن خدمة الطلبات
- **لا تحتاج تعديل كبير** — فقط دعم المرفقات

### خدمة المستخدمين (`apps/users/`)
- **بورت:** 4002
- **سكيما:** `users`
- **مهم:** جدول `employees` فيه حقل `managerId` يربط كل موظف بمديره المباشر
- **مهم:** جدول `departments` فيه حقل `managerId` يربط كل قسم بمديره

---

## المطلوب — ملخص

| # | التعديل | الأولوية |
|---|--------|---------|
| 1 | نظام موافقات ديناميكي (بدل المرحلتين الثابتة) | عالية |
| 2 | إضافة 7 أنواع طلبات جديدة | عالية |
| 3 | تحسين 3 أنواع طلبات موجودة | متوسطة |
| 4 | تحقق من الحقول حسب نوع الطلب | متوسطة |
| 5 | ربط الموافقة بالمدير المباشر الفعلي | متوسطة |

---

## التعديل 1: نظام الموافقات الديناميكي

### المشكلة
الموافقات حالياً مثبتة في جدول `Request` بأعمدة:
```
managerStatus, managerReviewedBy, managerReviewedAt, managerNotes
hrStatus, hrReviewedBy, hrReviewedAt, hrNotes
```
هذا يدعم مرحلتين فقط. بعض الطلبات تحتاج 3-4 مراحل.

### الحل
إضافة جدولين جديدين في `apps/requests/prisma/schema.prisma`:

#### جدول 1: `ApprovalWorkflow` — تعريف سلسلة الموافقات لكل نوع طلب

```prisma
model ApprovalWorkflow {
  id            String       @id @default(uuid())
  requestType   RequestType
  stepOrder     Int          // 1, 2, 3, 4...
  approverRole  ApproverRole
  isRequired    Boolean      @default(true)

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@unique([requestType, stepOrder])
  @@map("approval_workflows")
}

enum ApproverRole {
  DIRECT_MANAGER    // المدير المباشر (من managerId في employees)
  DEPARTMENT_MANAGER // مدير القسم
  TARGET_MANAGER     // المدير المنقول إليه (لطلبات النقل)
  HR                 // الموارد البشرية
  CEO                // المدير التنفيذي
  CFO                // المدير المالي
}
```

#### جدول 2: `ApprovalStep` — الموافقات الفعلية لكل طلب

```prisma
model ApprovalStep {
  id            String         @id @default(uuid())
  requestId     String
  stepOrder     Int
  approverRole  ApproverRole
  status        ApprovalStatus @default(PENDING)
  reviewedBy    String?        // employeeId الشخص اللي وافق/رفض
  reviewedAt    DateTime?
  notes         String?

  request       Request        @relation(fields: [requestId], references: [id], onDelete: Cascade)

  createdAt     DateTime       @default(now())

  @@unique([requestId, stepOrder])
  @@index([requestId])
  @@map("approval_steps")
}
```

#### تعديل `RequestStatus`:

```prisma
enum RequestStatus {
  DRAFT
  IN_APPROVAL       // ← جديد (بدل PENDING_MANAGER و PENDING_HR)
  APPROVED
  REJECTED
  CANCELLED

  // الحالات القديمة تبقى مؤقتاً للتوافق
  PENDING_MANAGER    // deprecated
  PENDING_HR         // deprecated
}
```

#### تعديل جدول `Request`:

```prisma
model Request {
  // ... الحقول الموجودة تبقى كما هي ...

  // إضافات جديدة:
  currentStepOrder  Int?             // رقم الخطوة الحالية
  approvalSteps     ApprovalStep[]   // ربط بخطوات الموافقة
  targetEmployeeId  String?          // الموظف المستهدف (للعقوبات/المكافآت/التفويض)

  // الحقول القديمة (managerStatus, hrStatus...) تبقى مؤقتاً
  // لكن الكود الجديد يستخدم ApprovalStep
}
```

### البيانات الأولية (Seed)

لازم نعبي جدول `ApprovalWorkflow` بسلاسل الموافقة لكل نوع طلب:

```
نوع الطلب             | خطوة 1          | خطوة 2 | خطوة 3 | خطوة 4
─────────────────────|─────────────────|────────|────────|────────
RESIGNATION          | DIRECT_MANAGER  | HR     | CEO    |
TRANSFER             | DIRECT_MANAGER  | TARGET_MANAGER | HR | CEO
PENALTY_PROPOSAL     | DIRECT_MANAGER  | HR     | CEO    |
REWARD               | DIRECT_MANAGER  | HR     | CEO    | CFO
OVERTIME_EMPLOYEE    | DIRECT_MANAGER  |        |        |
OVERTIME_MANAGER     | DIRECT_MANAGER  |        |        |
BUSINESS_MISSION     | DIRECT_MANAGER  | HR     | CEO    |
DELEGATION           | DIRECT_MANAGER  |        |        |
HIRING_REQUEST       | DIRECT_MANAGER  | HR     | CEO    |
COMPLAINT            | HR              |        |        |
ADVANCE              | DIRECT_MANAGER  | HR     |        |
PERMISSION           | DIRECT_MANAGER  |        |        |
OTHER                | DIRECT_MANAGER  | HR     |        |
```

---

## التعديل 2: أنواع الطلبات الجديدة

### تعديل `RequestType` enum

في `schema.prisma` و `create-request.dto.ts`:

```prisma
enum RequestType {
  // الموجودين
  TRANSFER
  PERMISSION
  ADVANCE
  RESIGNATION
  JOB_CHANGE
  RIGHTS
  REWARD
  SPONSORSHIP
  OTHER

  // الجدد
  PENALTY_PROPOSAL     // اقتراح عقوبة
  OVERTIME_EMPLOYEE    // تكليف عمل إضافي (موظف)
  OVERTIME_MANAGER     // تكليف عمل إضافي (مدير)
  BUSINESS_MISSION     // مهمة عمل
  DELEGATION           // تفويض
  HIRING_REQUEST       // طلب احتياج موظف
  COMPLAINT            // شكوى
}
```

---

## التعديل 3: الحقول المخصصة لكل نوع طلب

حالياً حقل `details` من نوع `Json?` يقبل أي شيء. المطلوب إضافة **تحقق (validation)** في الكود حسب نوع الطلب.

### ملف جديد: `apps/requests/src/requests/validators/request-details.validator.ts`

لكل نوع طلب، هذي الحقول المطلوبة في `details`:

#### RESIGNATION — استقالة
```typescript
{
  effectiveDate: string       // تاريخ الاستقالة المطلوب (مطلوب)
  reasons: string             // أسباب الاستقالة (مطلوب)
}
```
**قاعدة عمل:** `effectiveDate` لازم يكون بعد 30 يوم على الأقل من تاريخ التقديم.

#### TRANSFER — نقل
```typescript
{
  currentDepartmentId: string    // القسم الحالي (مطلوب)
  currentJobTitleId: string      // الوظيفة الحالية (مطلوب)
  newDepartmentId: string        // القسم الجديد (مطلوب)
  newJobTitleId: string          // الوظيفة الجديدة (مطلوب)
  currentSalary: number          // الراتب الحالي (اختياري)
  newSalary: number              // الراتب الجديد (اختياري)
}
```

#### PENALTY_PROPOSAL — اقتراح عقوبة
```typescript
{
  targetEmployeeId: string       // الموظف المخالف (مطلوب)
  targetJobTitle: string         // مسماه الوظيفي (مطلوب)
  violationDescription: string   // وصف المخالفة (مطلوب)
  proposedPenaltyType: string    // نوع العقوبة المقترحة (اختياري)
  finalPenaltyType: string       // نوع العقوبة النهائية (يعبيه CEO)
  finalPenaltyReason: string     // سبب العقوبة النهائية (يعبيه CEO)
}
```

#### OVERTIME_EMPLOYEE — تكليف عمل إضافي (موظف)
```typescript
{
  overtimeDate: string          // يوم التكليف (مطلوب)
  startTime: string             // ساعة البدء (مطلوب)
  endTime: string               // ساعة الانتهاء (مطلوب)
  totalHours: number            // إجمالي الساعات (مطلوب)
  tasks: string                 // المهام المطلوبة (مطلوب)
}
```
**قاعدة عمل:** لا يقبل التقديم بعد الساعة 12:00 ظهراً ليوم التكليف.

#### OVERTIME_MANAGER — تكليف عمل إضافي (مدراء)
```typescript
{
  overtimeDate: string          // يوم التكليف (مطلوب)
  startTime: string             // ساعة البدء (مطلوب)
  endTime: string               // ساعة الانتهاء (مطلوب)
  totalHours: number            // إجمالي الساعات (مطلوب)
  purpose: string               // الغرض (مطلوب)
}
```
**قاعدة عمل:** نفس قاعدة الـ 12 ظهراً.

#### BUSINESS_MISSION — مهمة عمل
```typescript
{
  missionType: 'INTERNAL' | 'EXTERNAL'  // نوع المهمة (مطلوب)
  startDate: string                      // تاريخ البدء (مطلوب)
  endDate: string                        // تاريخ النهاية (مطلوب)
  totalDays: number                      // عدد الأيام (مطلوب)
  destination: string                    // الجهة المستهدفة (مطلوب)
  missionReason: string                  // سبب المهمة (مطلوب)
}
```

#### DELEGATION — تفويض
```typescript
{
  delegationType: 'FULL' | 'PARTIAL'    // نوع الصلاحية (مطلوب)
  startDate: string                      // تاريخ البدء (مطلوب)
  endDate: string                        // تاريخ النهاية (مطلوب)
  delegateEmployeeId: string             // المفوض له (مطلوب)
  delegateJobTitle: string               // وظيفة المفوض له (مطلوب)
}
```

#### HIRING_REQUEST — طلب احتياج
```typescript
{
  positions: [                           // قائمة الوظائف المطلوبة (مطلوب، 1-10)
    {
      departmentId: string               // القسم (مطلوب)
      jobTitle: string                   // المسمى الوظيفي (مطلوب)
      count: number                      // العدد (مطلوب)
      reason: string                     // سبب الحاجة (مطلوب)
      gender: 'MALE' | 'FEMALE' | 'ANY' // الجنس (اختياري)
      educationLevel: string             // المستوى العلمي (اختياري)
      experienceYears: number            // سنوات الخبرة (اختياري)
    }
  ]
}
```

#### REWARD — مكافأة
```typescript
{
  employees: [                           // قائمة الموظفين (مطلوب، 1-10)
    {
      employeeId: string                 // الموظف (مطلوب)
      rewardType: string                 // نوع المكافأة (مطلوب)
      amount: number                     // المبلغ (مطلوب)
      reason: string                     // السبب (مطلوب)
    }
  ]
}
```

#### COMPLAINT — شكوى
```typescript
{
  complaintDescription: string           // وصف الشكوى (مطلوب)
  relatedPersons: string[]               // أشخاص للتواصل معهم (اختياري)
}
```

---

## التعديل 4: منطق الموافقات الجديد

### ملف: `apps/requests/src/requests/requests.service.ts`

#### عند تقديم الطلب (`submit`):

```
1. جلب سلسلة الموافقات من ApprovalWorkflow حسب نوع الطلب
2. إنشاء خطوات في ApprovalStep لكل مرحلة
3. تعيين currentStepOrder = 1
4. تغيير حالة الطلب إلى IN_APPROVAL
```

#### عند الموافقة (endpoint جديد `approve`):

```
1. جلب الطلب + الخطوة الحالية (currentStepOrder)
2. التحقق: هل المستخدم الحالي يطابق الـ approverRole للخطوة؟
   - DIRECT_MANAGER → هل هو managerId للموظف صاحب الطلب؟
   - HR → هل عنده صلاحية requests:hr-approve؟
   - CEO → هل عنده صلاحية requests:ceo-approve؟
   - CFO → هل عنده صلاحية requests:cfo-approve؟
   - TARGET_MANAGER → هل هو managerId للقسم الجديد في details.newDepartmentId؟
3. تحديث الخطوة: status = APPROVED, reviewedBy, reviewedAt, notes
4. هل في خطوة بعدها؟
   - نعم → currentStepOrder++, الطلب يبقى IN_APPROVAL
   - لا → حالة الطلب = APPROVED
5. تسجيل في RequestHistory
```

#### عند الرفض (endpoint جديد `reject`):

```
1. نفس التحقق من الصلاحية
2. تحديث الخطوة: status = REJECTED
3. حالة الطلب = REJECTED مباشرة (أي رفض ينهي الطلب)
4. تسجيل في RequestHistory
```

### كيف نعرف المدير المباشر؟

```sql
-- من خدمة الطلبات (cross-schema query)
SELECT e.id, e."managerId"
FROM users.employees e
WHERE e.id = :employeeId AND e."deletedAt" IS NULL
```

ثم نقارن: هل `managerId` للموظف صاحب الطلب = `employeeId` للشخص اللي يحاول يوافق؟

### كيف نعرف مدير القسم الجديد (للنقل)؟

```sql
SELECT d."managerId"
FROM users.departments d
WHERE d.id = :newDepartmentId AND d."deletedAt" IS NULL
```

---

## التعديل 5: الـ API الجديد

### ملف: `apps/requests/src/requests/requests.controller.ts`

#### Endpoints تبقى كما هي:
```
GET    /requests          → قائمة الطلبات
GET    /requests/my       → طلباتي
GET    /requests/:id      → طلب واحد
POST   /requests          → إنشاء طلب
POST   /requests/:id/submit  → تقديم الطلب
POST   /requests/:id/cancel  → إلغاء الطلب
```

#### Endpoints جديدة (تحل محل القديمة):
```
POST   /requests/:id/approve   → موافقة (النظام يعرف أي مرحلة تلقائياً)
POST   /requests/:id/reject    → رفض (النظام يعرف أي مرحلة تلقائياً)
GET    /requests/:id/approvals → عرض خطوات الموافقة وحالتها
GET    /requests/pending-my-approval → الطلبات التي تنتظر موافقتي
```

#### Endpoints قديمة (تبقى مؤقتاً للتوافق ثم تُحذف):
```
POST   /requests/:id/manager-approve  → deprecated
POST   /requests/:id/manager-reject   → deprecated
POST   /requests/:id/hr-approve       → deprecated
POST   /requests/:id/hr-reject        → deprecated
```

### DTOs جديدة:

#### `approve-step.dto.ts`
```typescript
export class ApproveStepDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
```

#### `reject-step.dto.ts`
```typescript
export class RejectStepDto {
  @IsNotEmpty()
  @IsString()
  notes: string;
}
```

---

## التعديل 6: الصلاحيات الجديدة

### صلاحيات تُضاف في جدول `permissions` (خدمة users):

```
requests:approve          → صلاحية عامة للموافقة (النظام يحدد المرحلة تلقائياً)
requests:reject           → صلاحية عامة للرفض
requests:ceo-approve      → موافقة المدير التنفيذي
requests:cfo-approve      → موافقة المدير المالي
requests:read-all-steps   → عرض كل خطوات الموافقة
requests:manage-workflows → إدارة سلاسل الموافقات
```

### صلاحيات موجودة تبقى:
```
requests:read             → عرض الطلبات
requests:manager-approve  → (deprecated لكن تبقى مؤقتاً)
requests:hr-approve       → موافقة HR (تبقى تُستخدم في المنطق الجديد)
```

### من يوافق على كل خطوة:

| ApproverRole | كيف نتحقق |
|-------------|-----------|
| DIRECT_MANAGER | `employees.managerId` = الموظف اللي يوافق |
| DEPARTMENT_MANAGER | `departments.managerId` = الموظف اللي يوافق |
| TARGET_MANAGER | `departments.managerId` للقسم الجديد = الموظف اللي يوافق |
| HR | صلاحية `requests:hr-approve` |
| CEO | صلاحية `requests:ceo-approve` |
| CFO | صلاحية `requests:cfo-approve` |

---

## التعديل 7: تحسينات الإجازات

### ملف: `apps/leave/prisma/schema.prisma`

#### إضافة حقل مرفقات:
```prisma
model LeaveRequest {
  // ... الموجود ...
  attachmentUrl   String?    // رابط المرفق (جديد)
}
```

لا تعديلات أخرى مطلوبة على خدمة الإجازات.

---

## ترتيب التنفيذ المقترح

### المرحلة 1: البنية التحتية
1. تعديل `schema.prisma` — إضافة `ApprovalWorkflow`, `ApprovalStep`, الأنواع الجديدة
2. تشغيل `prisma migrate dev`
3. إنشاء ملف seed لتعبئة `ApprovalWorkflow`
4. إضافة الصلاحيات الجديدة في خدمة users

### المرحلة 2: منطق الموافقات
5. إنشاء `ApprovalService` — منطق الموافقة/الرفض الديناميكي
6. إنشاء `ApprovalResolver` — يحدد هل المستخدم مسموح له يوافق على هالخطوة
7. تعديل `RequestsService.submit()` — ينشئ خطوات الموافقة تلقائياً
8. إضافة endpoints جديدة (`approve`, `reject`, `pending-my-approval`)

### المرحلة 3: التحقق من الحقول
9. إنشاء `RequestDetailsValidator` — يتحقق من `details` حسب نوع الطلب
10. ربطه بـ `RequestsService.create()` و `RequestsService.submit()`

### المرحلة 4: التنظيف
11. ربط الـ endpoints القديمة بالمنطق الجديد (للتوافق المؤقت)
12. اختبار كل أنواع الطلبات
13. حذف الـ endpoints القديمة بعد التأكد

---

## الملفات المتأثرة

```
apps/requests/
├── prisma/
│   ├── schema.prisma                    ← تعديل (إضافة جداول + أنواع)
│   └── seed.ts                          ← جديد (بيانات ApprovalWorkflow)
├── src/
│   ├── requests/
│   │   ├── requests.controller.ts       ← تعديل (endpoints جديدة)
│   │   ├── requests.service.ts          ← تعديل (منطق الموافقات)
│   │   ├── requests.module.ts           ← تعديل (إضافة services)
│   │   ├── approval.service.ts          ← جديد (منطق الموافقة الديناميكي)
│   │   ├── approval-resolver.service.ts ← جديد (تحديد من يوافق)
│   │   ├── validators/
│   │   │   └── request-details.validator.ts  ← جديد (تحقق الحقول)
│   │   └── dto/
│   │       ├── create-request.dto.ts    ← تعديل (أنواع جديدة)
│   │       ├── approve-step.dto.ts      ← جديد
│   │       ├── reject-step.dto.ts       ← جديد
│   │       └── list-requests.query.dto.ts ← تعديل (حالات جديدة)

apps/leave/
├── prisma/
│   └── schema.prisma                    ← تعديل (إضافة attachmentUrl)

apps/users/
└── (إضافة صلاحيات جديدة في seed/migration)
```

---

## ملخص نهائي

| البند | الوصع الحالي | بعد التعديل |
|------|-------------|------------|
| أنواع الطلبات | 9 أنواع | 16 نوع (+7 جدد) |
| مراحل الموافقة | 2 ثابتة (مدير → HR) | 1-4 ديناميكية حسب نوع الطلب |
| من يوافق | أي شخص عنده الصلاحية | المدير المباشر الفعلي (من managerId) |
| الحقول المخصصة | JSON حر بدون تحقق | حقول محددة ومتحقق منها لكل نوع |
| الموظف المستهدف | غير مدعوم | مدعوم (للعقوبات/المكافآت/التفويض) |
| جداول جديدة | — | `approval_workflows` + `approval_steps` |
| ملفات جديدة | — | 4 ملفات (approval service, resolver, validator, seed) |
| ملفات معدلة | — | 7 ملفات |
| Endpoints جديدة | — | 4 endpoints |
| Endpoints محذوفة (لاحقاً) | — | 4 endpoints قديمة |
