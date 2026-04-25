# دليل التصليحات بعد الدمج (Hardening Guide)

## عنوان الدليل
تصليحات ما قبل الإطلاق لنظام الطلبات الإدارية + الإجازات + الصلاحيات

## التاريخ
2026-04-14

## السياق
هذا الدليل **مكمّل** لـ `BACKEND_FINAL_MERGE_GUIDE_REQUESTS_LEAVE_2026-04-14.md`.
يُنفَّذ **بعد** الانتهاء من ذلك الدليل (توحيد الـ 11 نوعا + إضافة الصلاحيات الجديدة).

بعد مراجعة كود الطلبات + الإجازات + auth بعد افتراض تطبيق الدمج، وُجدت 14 نقطة مقسّمة على ثلاث أولويات:
- **P0** — مانع للإطلاق (ثغرات أمنية أو عيوب صلاحيات ظاهرة).
- **P1** — عيوب وظيفية أو أدائية تُصلَّح قبل الـ rollout الإنتاجي.
- **P2** — دَين تقني يُؤجَّل لدورة لاحقة.

---

## P0 — مانعات إطلاق (إجباري قبل الـ rollout)

### P0-1) ثغرة: أي مستخدم بصلاحية manager approve يعتمد طلب إجازة لأي موظف

**الملفات:**
- `apps/leave/src/leave-requests/leave-requests.service.ts`
- `apps/leave/src/leave-requests/leave-requests.controller.ts`

**الوصف:**
دوال `approveByManager` و `rejectByManager` لا تتحقق أن المستخدم هو فعلا مدير الموظف صاحب الطلب. أي موظف لديه صلاحية `leave_requests:approve_manager` يستطيع اعتماد أي طلب إجازة في النظام.

**الدليل على الثغرة:**
```ts
// leave-requests.service.ts — approveByManager
async approveByManager(id: string, dto: ApproveLeaveRequestDto, managerId: string) {
  const request = await this.prisma.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
  if (!request) throw new NotFoundException('Leave request not found');
  if (request.status !== 'PENDING_MANAGER') throw new BadRequestException(...);
  // ❌ لا يوجد فحص: هل managerId هو فعلا مدير employeeId؟
  ...
```

قارن بـ `ApprovalResolverService.canApprove` في خدمة الطلبات الإدارية التي تتحقق من `managerId` مطابق.

**الإصلاح المطلوب:**
1. أضِف helper جديد في الخدمة:
```ts
private async assertIsEmployeeManager(approverUserId: string, employeeId: string): Promise<void> {
  const rows = await this.prisma.$queryRaw<Array<{ managerId: string | null; approverId: string | null }>>`
    SELECT e."managerId",
           (SELECT id FROM users.employees WHERE "userId" = ${approverUserId} AND "deletedAt" IS NULL LIMIT 1) AS "approverId"
    FROM users.employees e
    WHERE e.id = ${employeeId} AND e."deletedAt" IS NULL LIMIT 1
  `;
  const row = rows[0];
  if (!row || !row.approverId || row.managerId !== row.approverId) {
    throw new ForbiddenException({
      code: 'AUTH_INSUFFICIENT_PERMISSIONS',
      message: 'You are not the direct manager of this employee',
      details: [],
    });
  }
}
```

2. استدعها في بداية `approveByManager` و `rejectByManager` **قبل** أي تحديث:
```ts
await this.assertIsEmployeeManager(managerUserId, request.employeeId);
```

3. لاحظ أن parameter اسمه `managerId` لكنه فعليا `userId` (قادم من `@UserId()` decorator). استبدل الاسم أو ضع تعليقا.

**بديل أبسط لو الـ HR يتجاوز فحص المدير:**
اعتمد نفس نمط ApprovalResolverService: إذا كان المستخدم يملك صلاحية `leave_requests:approve_hr` اسمح له بالموافقة على أي طلب حتى لو لم يكن المدير.

**اختبار القبول:**
- موظف A قدّم طلب إجازة، موظف B (ليس مديره، لكن له صلاحية `approve_manager`) → يجب أن يفشل بـ 403.
- موظف A قدّم طلب إجازة، مديره المباشر اعتمد → نجاح.

---

### P0-2) ثغرة أخرى: HR approval بدون فحص دور HR الفعلي

**الملف:** `apps/leave/src/leave-requests/leave-requests.service.ts`

**الوصف:**
`approveByHR` و `rejectByHR` تعتمدان فقط على وجود permission `leave_requests:approve_hr` في JWT. إذا أُعطيت هذه الصلاحية لدور غير HR (سهوا) سيعتمد كأنه HR.

**الأثر:** أقل خطورة من P0-1 لأن الصلاحية نفسها هي نقطة التحكم، لكن لا يوجد دفاع في العمق.

**الإصلاح المطلوب (اختياري وموصى به):**
أضف تحققا إضافيا أن المستخدم فعلا في دور `hr_manager` أو أي دور موسوم `isHrRole` (يحتاج إضافة علامة على جدول الأدوار أو mapping في config). إذا اعتُبر overkill، اكتفِ بتوثيق أن هذه الصلاحية **لا تُمنح** إلا لأدوار HR.

**اختبار القبول:**
- Audit سريع لـ `role_permissions`: لا يوجد دور غير HR لديه `leave_requests:approve_hr`.

---

### P0-3) تضارب super_admin permissions بين login و refresh

**الملف:** `apps/auth/src/auth/auth.service.ts`

**الوصف:**
قائمة الـ super_admin permissions موجودة **مكرّرة** في مكانين:
- Inline في `login()` السطور 67-110 (بدون `requests:approve`, `requests:ceo-approve`, `requests:cfo-approve`, `requests:reject`).
- `getSuperAdminPermissions()` السطور 314-362 (مع `requests:approve`, `requests:ceo-approve`, `requests:cfo-approve` — لكن بدون `requests:reject`، وفيه تكرار لـ `requests:hr-approve`).

**النتيجة:** super_admin بعد login **لا يستطيع** استخدام endpoints الموافقة الديناميكية (`POST /requests/:id/approve`). بعد أول refresh يعمل. bug غريب يربك الفرونت.

**الإصلاح المطلوب:**

1. **حذف القائمة الـ inline في `login()`** (السطور 67-110) واستبدالها بنداء `this.getSuperAdminPermissions()`:
```ts
if (userRoles.some(r => r.name === 'super_admin')) {
  finalRoles = ['super_admin'];
  finalPermissions = this.getSuperAdminPermissions();
} else if (userRoles.length > 0) {
  ...
}
```

2. **تحديث `getSuperAdminPermissions()` لتكون مصدر الحقيقة الوحيد:**
   - أضف `'requests:reject'` إن أبقيت permission منفصلة للرفض (انظر القسم P1-1).
   - احذف التكرار في `requests:hr-approve` (ورد مرتين في السطر 348 و 360).

**قائمة الصلاحيات النهائية التي يجب أن تحتويها `getSuperAdminPermissions()` في قسم الطلبات:**
```ts
'requests:read',
'requests:approve',
'requests:reject',              // إذا اعتُمدت (انظر P1-1)
'requests:manager-approve',     // legacy — باقٍ مؤقتا
'requests:manager-reject',      // legacy
'requests:hr-approve',
'requests:hr-reject',           // legacy
'requests:ceo-approve',
'requests:cfo-approve',
'requests:read-all-steps',
'requests:manage-workflows',
```

**اختبار القبول:**
- Login بمستخدم admin، ثم `POST /requests/:id/approve` على طلب في حالته IN_APPROVAL → لا يجب أن يرجع 403 بسبب نقص permission.
- Login ثم فورا refresh — قائمة الصلاحيات يجب أن تكون متطابقة تماما.

---

## P1 — عيوب وظيفية/أدائية قبل rollout

### P1-1) حسم صلاحية الرفض: `requests:approve` أم `requests:reject`

**الملف:** `apps/requests/src/requests/requests.controller.ts`

**الوضع الحالي:**
```ts
@Permission('requests:approve')
@Post(':id/reject')
rejectStep(...) { ... }
```

الرفض يتطلب `requests:approve`. أضيفت `requests:reject` في migration الصلاحيات لكنها لا تُستخدم.

**القرار المطلوب (اختر واحدا فقط):**

**الخيار A:** اعتماد permission واحدة `requests:approve` للموافقة والرفض:
- احذف `requests:reject` من migration الصلاحيات (أو أبقها معطّلة في seed).
- احذفها من `permissions.constants.ts`.
- وثّق في API docs أن `approve` تغطي كليهما.

**الخيار B (الأنظف):** استخدام `requests:reject` للرفض:
- عدّل الـ decorator:
```ts
@Permission('requests:reject')
@Post(':id/reject')
```
- تأكد أن `requests:reject` في `getSuperAdminPermissions()`.
- أضِفها إلى roles المناسبة في seed.

**الأثر:** إبقاء الوضع الحالي يمنع كتابة سياسات role أدق (مثل role يعتمد بدون صلاحية رفض).

---

### P1-2) `executeApprovedRequest` يعالج TRANSFER فقط

**الملف:** `apps/requests/src/requests/approval.service.ts` (السطور 268-288)

**الوضع الحالي:**
```ts
private async executeApprovedRequest(request: any): Promise<void> {
  try {
    const details = request.details as any;
    if (request.type === 'TRANSFER') {
      // يحدث department/jobTitle في users.employees
    }
  } catch (err) { console.error(...); }
}
```

الأنواع الأخرى (RESIGNATION, REWARD, HIRING_REQUEST, PENALTY_PROPOSAL, DELEGATION, OVERTIME_EMPLOYEE, OVERTIME_MANAGER, BUSINESS_MISSION, COMPLAINT, OTHER) لا تُنفِّذ أي إجراء جانبي عند الاعتماد.

**القرار المطلوب:**

**الخيار A (موصى به قبل الإطلاق):** وثّق صراحة أن كل الأنواع عدا TRANSFER لا تنفِّذ إجراء تلقائيا — HR يتابع يدويا. أضف في الـ response أو في notification flag "يتطلب إجراء HR يدوي".

**الخيار B:** نفِّذ الإجراءات الأكثر أهمية:
- **RESIGNATION:** تحديث `employmentStatus = 'RESIGNED'` + `terminationDate = details.effectiveDate`.
- **DELEGATION:** إدخال سجل في جدول delegation (إن وجد) للفترة المحددة.
- **HIRING_REQUEST:** فتح vacancies في جدول job_openings (إن وجد).
- **REWARD / PENALTY_PROPOSAL:** إنشاء سجل في payroll adjustments.

**نصيحة:** قبل تنفيذ الخيار B، اجتمع مع HR لتوثيق كل side-effect المتوقع لكل نوع. التنفيذ الجزئي أسوأ من التوثيق الواضح.

---

### P1-3) `cancel` لا يُغلق خطوات الاعتماد المعلقة

**الملف:** `apps/requests/src/requests/requests.service.ts` (السطور 178-204)

**الوصف:**
عند إلغاء طلب في حالة `IN_APPROVAL`، `approval_steps` الخاصة به تبقى بحالة `PENDING`. يُصعّب التقارير ("كم طلب تم إلغاؤه أثناء مراجعة HR؟").

**الإصلاح:**
داخل `cancel` قبل `await this.prisma.request.update`:
```ts
if (request.status === 'IN_APPROVAL') {
  await this.prisma.approvalStep.updateMany({
    where: { requestId: id, status: 'PENDING' },
    data: { status: 'REJECTED', notes: 'Auto-closed: request cancelled by employee' },
  });
}
```

ثم اجعل العمليات الثلاث (update request + updateMany steps + create history) في `$transaction` واحد.

---

### P1-4) `GET /requests/:id` لا يفحص ownership

**الملف:** `apps/requests/src/requests/requests.controller.ts`

**الوضع الحالي:**
```ts
@Permission('requests:read')
@Get(':id')
findOne(@Param('id') id: string) { ... }
```

أي موظف لديه `requests:read` يرى أي طلب في النظام (بما فيها الرواتب والاستقالات الخاصة بزملائه).

**الإصلاح المطلوب:**
اجعل `findOne` يمرر `userId` ويطبق قاعدة:
- يرى صاحب الطلب طلبه.
- يرى HR (صلاحية `requests:hr-approve`) كل شيء.
- يرى المدير طلبات مرؤوسيه فقط.
- يرى CEO/CFO طلبات في مسار اعتماده فقط (أو الكل حسب السياسة).

**تعديل controller:**
```ts
@Get(':id')
@UseGuards(JwtAuthGuard) // permission يُطبَّق داخل service
findOne(@Param('id') id: string, @CurrentUser() user: any) {
  return this.requests.findOneScoped(id, user.userId, user.permissions);
}
```

**منطق `findOneScoped` في service:**
```ts
async findOneScoped(id: string, userId: string, permissions: string[]) {
  const request = await this.findOne(id);
  const employeeId = await this.getEmployeeIdByUserId(userId);
  const isOwner = request.employeeId === employeeId;
  const isHr = permissions.includes('requests:hr-approve');
  const isInApprovalChain = await this.approvalService.hasApprovalStep(id, userId);
  if (!isOwner && !isHr && !isInApprovalChain) {
    throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'Not authorized to view this request', details: [] });
  }
  return request;
}
```

نفس المبدأ يجب تطبيقه على `list()` (اجعله يُرجع فقط ما يحق للمستخدم رؤيته إذا لم يكن HR).

---

### P1-5) Race condition في تحديث رصيد الإجازة

**الملف:** `apps/leave/src/leave-requests/leave-requests.service.ts` (السطور 48-77)

**الوصف:**
```ts
const balance = await client.leaveBalance.findFirst({ where: ... });
const newUsedDays = balance.usedDays + usedDays;
const newPendingDays = balance.pendingDays + pendingDays;
await client.leaveBalance.update({ where: { id }, data: { usedDays: newUsedDays, ... } });
```

Read-then-write بدون lock. طلبان متزامنان لنفس الموظف يقرآن `usedDays=5`، كلاهما يحسب `5+2=7`، تفوت خصومة.

**الإصلاح:** استخدم atomic `increment`/`decrement`:
```ts
private async updateLeaveBalance(
  employeeId: string, leaveTypeId: string, year: number,
  usedDelta: number, pendingDelta: number, tx?: any,
) {
  const client = tx ?? this.prisma;
  const balance = await client.leaveBalance.findFirst({
    where: { employeeId, leaveTypeId, year },
    select: { id: true, totalDays: true, carriedOverDays: true },
  });
  if (!balance) throw new BadRequestException('Leave balance not found');

  // update ذرية على مستوى SQL
  const updated = await client.leaveBalance.update({
    where: { id: balance.id },
    data: {
      usedDays: { increment: usedDelta },
      pendingDays: { increment: pendingDelta },
    },
    select: { usedDays: true, pendingDays: true, totalDays: true, carriedOverDays: true },
  });

  // احسب remainingDays من القيم الجديدة
  const remaining = (updated.totalDays + (updated.carriedOverDays ?? 0)) - updated.usedDays - updated.pendingDays;
  if (remaining < 0) {
    // rollback يدوي
    throw new BadRequestException('Insufficient balance after concurrent update');
  }
  await client.leaveBalance.update({ where: { id: balance.id }, data: { remainingDays: remaining } });
}
```

**بديل أبسط:** اعتبر `remainingDays` computed field عند القراءة فقط، واحذف التخزين. يقلل نقاط الخطأ.

---

### P1-6) `status` في LeaveRequest حقل String وليس enum

**الملف:** `apps/leave/prisma/schema.prisma` (السطر 73)

**الوضع الحالي:**
```prisma
status String @default("DRAFT")
```

لا يمنع DB typo مثل `"APPROVD"`.

**الإصلاح:**
```prisma
enum LeaveRequestStatus {
  DRAFT
  PENDING_MANAGER
  PENDING_HR
  APPROVED
  REJECTED
  CANCELLED

  @@schema("leaves")
}

model LeaveRequest {
  ...
  status LeaveRequestStatus @default(DRAFT)
  ...
}
```

مع migration يُحوّل العمود ويتحقق أن القيم القائمة كلها ضمن النطاق.
نفس المبدأ يُطبَّق على `managerStatus` و `hrStatus` (ApprovalStatus enum موجود بالفعل).

---

### P1-7) `createOnLeaveAttendanceRecords` تبتلع الأخطاء

**الملف:** `apps/leave/src/leave-requests/leave-requests.service.ts` (السطور 478-498)

**الوصف:**
إذا فشل إدراج سجلات ON_LEAVE في attendance، الإجازة تُعتمَد بدون أثر في الحضور. الخطأ يُطبع في console فقط.

**الإصلاح:**
1. اجعل العملية جزءا من transaction الاعتماد (`approveByManager` / `approveByHR`).
2. أو: عند الفشل، أنشئ سجل alert في `attendance.alerts` ليعالجه HR يدويا:
```ts
} catch (err) {
  await this.prisma.$queryRawUnsafe(`
    INSERT INTO attendance.alerts (id, "employeeId", type, severity, message, "createdAt")
    VALUES (gen_random_uuid(), $1, 'ON_LEAVE_SYNC_FAILED', 'HIGH', $2, NOW())
  `, employeeId, `فشل إنشاء سجلات ON_LEAVE للفترة ${startDate.toISOString()} - ${endDate.toISOString()}: ${err.message}`);
}
```

---

### P1-8) `getPendingMyApproval` يحمّل كل IN_APPROVAL في الذاكرة

**الملف:** `apps/requests/src/requests/approval.service.ts` (السطور 189-266)

**الوصف:**
```ts
const allPending = await this.prisma.request.findMany({
  where: { status: 'IN_APPROVAL', deletedAt: null },
  include: { approvalSteps: true },
  orderBy: { createdAt: 'desc' },
});
```

يجلب كل الطلبات المعلقة في النظام ثم يفلتر في الذاكرة. عند 10K طلب نشط، كل استدعاء يفرغ كل شيء.

**الإصلاح:**
استعلام واحد على DB يرجّع الطلبات التي current approval step لها دور يخص المستخدم:

```sql
-- Pseudocode: تم تحديد الأدوار التي يغطيها المستخدم قبلها
SELECT r.* 
FROM requests r
JOIN approval_steps s ON s."requestId" = r.id 
  AND s."stepOrder" = r."currentStepOrder" 
  AND s.status = 'PENDING'
WHERE r.status = 'IN_APPROVAL'
  AND r."deletedAt" IS NULL
  AND (
    (s."approverRole" = 'DIRECT_MANAGER'     AND r."employeeId" IN (SELECT id FROM users.employees WHERE "managerId" = $approverEmpId))
    OR (s."approverRole" = 'DEPARTMENT_MANAGER' AND r."employeeId" IN (SELECT e.id FROM users.employees e JOIN users.departments d ON e."departmentId" = d.id WHERE d."managerId" = $approverEmpId))
    OR (s."approverRole" = 'TARGET_MANAGER'  AND (r.details->>'newDepartmentId') IN (SELECT id FROM users.departments WHERE "managerId" = $approverEmpId))
    OR (s."approverRole" = 'HR'  AND $hasHrApprove)
    OR (s."approverRole" = 'CEO' AND $hasCeoApprove)
    OR (s."approverRole" = 'CFO' AND $hasCfoApprove)
  )
ORDER BY r."createdAt" DESC
LIMIT $limit OFFSET $offset;
```

الـ total يُحسَب بنفس المنطق بـ COUNT(*).

---

## P2 — دَين تقني (بعد الإطلاق)

### P2-1) حقول orphan في Request schema

**الملف:** `apps/requests/prisma/schema.prisma` (السطور 68-76)

الحقول `managerStatus`, `managerReviewedBy`, `managerReviewedAt`, `managerNotes`, `hrStatus`, `hrReviewedBy`, `hrReviewedAt`, `hrNotes` لم تعد تُكتَب بعد الانتقال لنظام approval_steps.

**التوصية:**
- اكتب migration يحذف الأعمدة.
- أو اتركها وعلِّم عليها `@deprecated` في schema مع تعليق (إذا كانت تقارير قديمة تقرؤها).
- القرار يؤجَّل حتى يتأكد من أن لا dashboard أو export يقرأها.

---

### P2-2) hardcoded super_admin permissions

**الملف:** `apps/auth/src/auth/auth.service.ts`

**الوصف:**
حتى بعد توحيد القائمة في `getSuperAdminPermissions()` (P0-3)، يبقى anti-pattern: إضافة permission جديدة تتطلب تعديل الكود.

**الإصلاح الموصى به:**
```ts
private async loadSuperAdminPermissions(): Promise<string[]> {
  const rows = await this.prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM users.permissions
  `;
  return rows.map(r => r.name);
}
```

ثم استخدمها في `login` و `refresh`. النتيجة: أي permission يُضاف في migration أو seed يصبح متاحا تلقائيا لـ super_admin.

---

### P2-3) `permissions.constants.ts` ناقص ومكرَّر

**الملف:** `packages/shared/src/constants/permissions.constants.ts`

أضف في قسم REQUESTS (حتى بعد تنفيذ الدليل السابق):
```ts
REQUESTS: {
  READ:             'requests:read',
  APPROVE:          'requests:approve',
  REJECT:           'requests:reject',           // حسب قرار P1-1
  MANAGER_APPROVE:  'requests:manager-approve',  // legacy
  MANAGER_REJECT:   'requests:manager-reject',   // legacy
  HR_APPROVE:       'requests:hr-approve',
  HR_REJECT:        'requests:hr-reject',        // legacy
  CEO_APPROVE:      'requests:ceo-approve',
  CFO_APPROVE:      'requests:cfo-approve',
  READ_ALL_STEPS:   'requests:read-all-steps',
  MANAGE_WORKFLOWS: 'requests:manage-workflows',
}
```

---

### P2-4) انعدام soft-delete في LeaveRequest

**الملف:** `apps/leave/prisma/schema.prisma`

`requests` عنده `deletedAt`، `leave_requests` ليس عنده — عدم اتساق.
أضف `deletedAt DateTime?` وعدِّل `remove()` لتصبح soft delete، واستثنِها من كل الـ queries.

---

### P2-5) JWT يحمل permissions لحظة الإصدار

**الموقع:** توثيق فقط.

إذا حُذفت صلاحية من مستخدم، لا يسري التغيير حتى يُصدر له JWT جديد (access token TTL). بالنسبة لنظام HR مقبول لكن يجب توثيقه صراحة في `API_DOCUMENTATION.md`.

إذا كان سيناريو "revocation فورية للصلاحيات" مطلوبا، أضف endpoint `POST /auth/invalidate-user/:userId` يكتب في جدول `revoked_users` ويُتحقَّق منه في `JwtStrategy`.

---

### P2-6) cross-schema raw SQL منثور

خدمة الطلبات + خدمة الإجازات كلاهما يستخدم `$queryRawUnsafe` للوصول إلى `users.employees` و `users.departments`. يعمل حاليا لأن كل الخدمات تشارك نفس قاعدة البيانات بأذونات واسعة. عند الفصل المستقبلي (microservices حقيقية بـ DBs منفصلة)، سينكسر كل هذا.

**التوصية المستقبلية:** استخدام events أو REST calls بين الخدمات بدل cross-schema queries.

---

## خطة التنفيذ الموصى بها

### المرحلة 1: P0 (2-3 أيام)
1. P0-1: فحص المدير في leave approvals.
2. P0-2: توثيق/فحص دور HR.
3. P0-3: توحيد super_admin permissions في auth.service.ts.

### المرحلة 2: P1 (5-7 أيام)
4. P1-1: حسم permission الرفض.
5. P1-2: قرار executeApprovedRequest (توثيق أو تنفيذ).
6. P1-3: cancel يغلق steps.
7. P1-4: ownership scoping على GET :id و list.
8. P1-5: atomic balance update في leave.
9. P1-6: status enum في leave.
10. P1-7: معالجة فشل createOnLeaveAttendanceRecords.
11. P1-8: DB-side filtering في getPendingMyApproval.

### المرحلة 3: P2 (دورة لاحقة)
12-17. كما مذكور.

---

## قائمة اختبارات القبول النهائية

قبل اعتبار الإطلاق جاهزا:

### Leave Requests
- [ ] مستخدم غير مدير الموظف + لديه `approve_manager` → `POST /approve-manager` يفشل بـ 403.
- [ ] المدير المباشر فعلا → ينجح.
- [ ] اعتماد إجازتين متزامنتين لنفس الموظف (load test بسيط بـ 50 concurrent request) → balance صحيح (لا يفوت خصم).
- [ ] cancel بعد APPROVED → الرصيد يُعاد بالكامل.
- [ ] leaveType.requiresApproval=false → manager approve → APPROVED مباشرة + سجلات ON_LEAVE في attendance.

### Administrative Requests
- [ ] إنشاء طلب لكل نوع من الأنواع 11 → submit → approval_steps صحيحة.
- [ ] DIRECT_MANAGER في الخطوة 1 → غير المدير يفشل، المدير ينجح.
- [ ] DELEGATION → TARGET_MANAGER في الخطوة 2 → فقط مدير القسم من `details.newDepartmentId` يستطيع.
- [ ] HIRING_REQUEST → DEPARTMENT_MANAGER في الخطوة 1 → فقط مدير قسم الموظف صاحب الطلب.
- [ ] reject في أي خطوة → الطلب REJECTED، الخطوات التالية لا تتفعّل.
- [ ] cancel على IN_APPROVAL → steps المعلقة تُغلق (بعد P1-3).
- [ ] موظف عادي بـ `requests:read` → `GET /requests/:otherId` يفشل (بعد P1-4).

### Permissions / Auth
- [ ] Login super_admin ثم `POST /requests/:id/approve` → ينجح.
- [ ] قائمة permissions في response login == قائمة في response refresh (diff فارغ).
- [ ] مستخدم بدون `requests:approve` → endpoint يفشل بـ 403.
- [ ] مستخدم بـ `requests:approve` لكن ليس مدير/HR → `canApprove` في resolver يفشل بـ 403.

---

## تعريف نجاح التصليحات

- كل اختبارات P0 تمر.
- اختبارات P1 تمر أو موثّقة كمقبولة.
- `auth.service.ts` لا يحتوي قائمة permissions مكررة.
- `getSuperAdminPermissions()` مصدر الحقيقة الوحيد.
- leave approvals تُرفض إذا لم يكن المعتمد مدير الموظف.
- `cancel` على طلب IN_APPROVAL يُغلق خطواته.
- load test بـ 50 concurrent leave approvals على نفس الموظف لا يُفقد خصم الرصيد.

---

نهاية الدليل.
