# خطة تعديلات الباك اند - النسخة الكاملة المحدّثة (وظيفية + صلاحيات + مالية + حضور)

**التاريخ:** 2026-04-13  
**آخر تحديث:** 2026-04-13 (مراجعة ثانية — تحقق آلي من الكود المصدري)  
**المشروع:** HR Management System - NestJS Monorepo  
**هدف هذه النسخة:** معالجة جميع مشاكل الوظائف والصلاحيات والحسابات المالية، وتأجيل البنود الأمنية البحتة لباكلوغ لاحق.

> **ملاحظة:** هذا الملف مبني على مراجعة مباشرة للكود المصدري بتاريخ 2026-04-13.  
> تم التحقق آلياً من كل بند مقابل الكود الفعلي. البنود المصححة أو الجديدة مُعلَّمة بـ `[محدَّث]` أو `[جديد]`.

---

## 1) نطاق هذه النسخة

**داخل النطاق:**
- صحة منطق الأعمال (Workflow correctness)
- توحيد الهوية بين `userId` و `employeeId`
- ضبط الصلاحيات (Permissions/Guards) على المسارات الحساسة
- صحة الحسابات المالية (راتب، رصيد إجازات، خصومات، مكافآت)
- سلامة تدفق الحضور والتبريرات
- تكامل الخدمات (Payroll ↔ Leave ↔ Requests)
- اختبار التدفقات الوظيفية الأساسية

**خارج النطاق (مؤجل للـ Security Backlog):**
- تدوير الأسرار والمفاتيح
- Service-to-Service auth
- CORS/Helmet hardening
- تحسينات الأمان التشغيلية المتقدمة

---

## 2) أولويات التنفيذ

- **P0 (حرج - يوقف العمل كلياً):** أخطاء تمنع تنفيذ الوظيفة الأساسية أو تنتج بيانات مالية خاطئة
- **P1 (عالي - ثغرة صلاحيات أو تدفق خاطئ):** أي مستخدم يقدر يتجاوز دوره أو يتلاعب بحالة كيانات لا يملكها
- **P2 (متوسط - أداء أو اتساق):** مشاكل لا تكسر النظام الآن لكن تصبح خطيرة مع النمو

---

## 3) المرحلة 0 — إصلاحات وظيفية حرجة (P0)

### 3.1 خدمة التقييم (`evaluation-service`)

#### أ) خلط userId مع employeeId في evaluation-forms [محدَّث]
**الأولوية:** P0  
**الأثر:** كل موظف يحصل على 403 عند محاولة تعبئة أو إرسال تقييمه الذاتي.

**المشكلة — الأماكن الثلاثة الخاطئة في الكود:**
```
apps/evaluation-service/src/evaluation-forms/evaluation-forms.service.ts
  السطر 179: form.employeeId === user.userId        ← خاطئ (findOne)
  السطر 198: form.employeeId !== user.userId        ← خاطئ (saveSelfEvaluation)
  السطر 255: form.employeeId !== user.userId        ← خاطئ (submitSelfEvaluation)
```

> **تصحيح عن النسخة السابقة:** السطران 321 و 514 **ليسا خطأ**. حقل `evaluatorId` يخزّن `userId` أصلاً وليس `employeeId`، فالمقارنة `form.evaluatorId !== user.userId` صحيحة. كذلك `evaluatorId: user.userId` في السطر 514 صحيح.

**الحل المطلوب:**
- إنشاء دالة مشتركة `resolveEmployeeId(userId)` تستخدم `queryRaw` على `users.employees WHERE "userId" = $1` (على غرار `getMyForm` السطر 77 الذي يعمل بشكل صحيح)
- استبدال المقارنات المباشرة بالمقارنة بعد resolve في الأماكن **الثلاثة** فقط (179, 198, 255)
- **لا تعدّل** السطرين 321 و 514

---

#### ب) findPendingMyAction في Probation — مقارنة تحتاج تحقق [محدَّث]
**الأولوية:** P0  
**الأثر:** الموظف قد لا يرى تقييم فترته التجريبية المنتظر إقراره — workflow يعلق.

```
apps/evaluation-service/src/probation-evaluations/probation-evaluations.service.ts
  السطر 279: { employeeId: userId, status: 'PENDING_EMPLOYEE_ACKNOWLEDGMENT' }
```

> **ملاحظة:** يجب التحقق من schema الـ probation أولاً — إذا كان حقل `employeeId` في جدول `ProbationEvaluation` يخزّن `userId` مباشرة فالكود صحيح. أما إذا كان يخزّن employee record ID (وهو الأرجح بناءً على بقية الكود) فيجب resolve أولاً.

**الحل المطلوب:**
- فحص الـ schema: إذا كان `employeeId` يشير إلى `employees.id` → resolve الـ userId إلى employeeId أولاً
- إذا كان يشير إلى `users.id` → لا حاجة لتعديل

---

#### ج) generateForms بدون evaluatorId
**الأولوية:** P0  
**الأثر:** الفورمات تُنشأ بنجاح لكن بـ `evaluatorId = NULL`. لا مدير يراها في pending list ولا يمكن بدء workflow المدير عليها.

```
apps/evaluation-service/src/evaluation-periods/evaluation-periods.service.ts
  السطور 197-208: إنشاء فورم بدون evaluatorId
```

**الحل المطلوب:**
- تحديد سياسة واضحة لتعيين المقيّم: إما `employee.managerId` أو يُمرر مع طلب الإنشاء
- تطبيق السياسة عند `generateForms` وعند `create` الفردي

---

#### د) تقارير التقييم دائماً فارغة
**الأولوية:** P0 (نتيجة مباشرة لبوغ أ + ج)  
**الأثر:** HR ترى صفر نتائج في جميع تقارير التقييم الأربعة (توزيع الدرجات، مقارنة الأقسام، التوصيات، التقرير التفصيلي).

```
apps/evaluation-service/src/evaluation-reports/evaluation-reports.service.ts
  السطر 19: WHERE ef.status = 'COMPLETED'   (gradeDistribution)
  السطر 34: نفس الشرط                       (departmentComparison)
  السطر 75: نفس الشرط                       (recommendations)
  السطر 120: نفس الشرط                      (detailedReport)
```

**الحل:** إصلاح البوغ (أ) و (ج) أعلاه يحل هذا تلقائياً — الفورمات ستصل لحالة COMPLETED.

---

### 3.2 خدمة الحضور — الحسابات المالية (`attendance-service`)

#### أ) حساب الغياب والخصم في Payroll خاطئ
**الأولوية:** P0  
**الأثر:** الراتب المحسوب قد يكون أعلى أو أقل من الصحيح بسبب تناقض في حساب أيام الغياب غير المبررة.

```
apps/attendance/src/payroll/payroll.service.ts
  السطر 96-103: الحلقة تحسب absentUnjustified بناءً على التبريرات الفعلية
  السطر 133:    absentDays = Math.max(0, workingDays - presentDays)  ← يُعيد الحساب بشكل خاطئ
  السطر 134:    absentUnjustified = Math.min(absentUnjustified, absentDays)
```

**تفصيل المشكلة:**
- `presentDays` لا يحتسب `WEEKEND`/`HOLIDAY`/`ON_LEAVE`/`ABSENT`
- فالصيغة `workingDays - presentDays` تُعطي رقماً مبالغاً فيه (مثال: 22 يوم عمل - 15 حضور = 7 غياب، بينما الفعلي قد يكون 1 فقط بسبب إجازات وعطل)

**الحل المطلوب:**
- إعادة كتابة منطق الحساب: `absentUnjustified` = (سجلات ABSENT بدون تبرير مقبول)
- عدم إعادة الحساب بطريقة `workingDays - presentDays`
- الاستعلام عن التبريرات المقبولة مرة واحدة قبل الحلقة بدل داخلها

---

#### ب) خصم تكرار التأخير محسوب لكن لا يُخصم من الراتب [جديد]
**الأولوية:** P0  
**الأثر:** الموظف الذي يتجاوز حد التأخير المتكرر لا يُخصم منه شيء رغم وجود سياسة خصم.

```
apps/attendance/src/payroll/payroll.service.ts
  السطر 141-173: repeatLatePenaltyDaysCalc يُحسب
  السطر 235:     يُخزَّن في DB
  السطر 212:     netSalary = grossSalary - deductionAmount - absenceDeductionAmount
                  ← لا يوجد خصم لـ repeatLatePenaltyDaysCalc!
```

**الحل المطلوب:**
```
const repeatLatePenaltyAmount = repeatLatePenaltyDaysCalc * dailyRate;
const netSalary = grossSalary - deductionAmount - absenceDeductionAmount - repeatLatePenaltyAmount;
```

---

#### ج) لا يوجد تكامل مع خدمة الإجازات — الإجازات المعتمدة تُحسب غياب [جديد]
**الأولوية:** P0  
**الأثر:** موظف أخذ إجازة معتمدة رسمياً → نظام الرواتب يحسبها غياب ويخصم من راتبه!

```
apps/attendance/src/payroll/payroll.service.ts
  السطر 106: يفحص status === 'ON_LEAVE' في سجل الحضور
  ← لكن لا يوجد آلية لتحويل الإجازات المعتمدة من leave-service إلى سجلات ON_LEAVE في attendance
  ← لا يوجد HTTP client أو RPC أو event bus بين الخدمتين
```

**الحل المطلوب:**
- إما: عند اعتماد الإجازة في leave-service → إنشاء سجلات حضور بحالة `ON_LEAVE` لكل يوم إجازة
- أو: في payroll عند الحساب → استعلام مباشر على `leaves.leave_requests WHERE status = 'APPROVED'` للفترة المطلوبة

---

#### د) لا يوجد تكامل مع خدمة الطلبات — المكافآت والجزاءات لا تظهر في الراتب [جديد]
**الأولوية:** P0  
**الأثر:** المكافآت (REWARD) والجزاءات (PENALTY_PROPOSAL) المعتمدة لا تُضاف أو تُخصم من الراتب ولا تظهر في كشف الراتب.

```
apps/attendance/src/payroll/payroll.service.ts
  ← لا يوجد أي كود يستعلم عن الطلبات المعتمدة من requests-service
  
apps/requests/prisma/schema.prisma
  ← يوجد أنواع طلبات: REWARD, PENALTY_PROPOSAL

كشف الراتب الحالي (السطور 390-432) يعرض فقط:
  - الراتب الأساسي + البدلات + الأوفرتايم - خصومات الحضور
  - لا يعرض: المكافآت، الجزاءات، السلف
```

**الحل المطلوب:**
- إضافة حقول في MonthlyPayroll model: `bonusAmount`, `penaltyAmount`, `bonusDetails`, `penaltyDetails`
- عند توليد الراتب: استعلام الطلبات المعتمدة (REWARD/PENALTY_PROPOSAL) للفترة
- تعديل صيغة الراتب:
  ```
  netSalary = grossSalary + bonusAmount - deductions - absenceDeductions - penaltyAmount
  ```
- تعديل كشف الراتب ليعرض هذه البنود

---

#### هـ) الطلبات المالية (نقل، مكافأة) لا تُنفَّذ بعد الاعتماد [جديد]
**الأولوية:** P0  
**الأثر:** طلب نقل موظف (TRANSFER) أو مكافأة (REWARD) يمر بكل مراحل الموافقة ويصل لحالة APPROVED — لكن لا شيء يحدث فعلياً! لا تحديث للقسم ولا تحديث للراتب.

```
apps/requests/src/requests/requests.service.ts
  السطور 199-239: hrApprove() تغيّر الحالة إلى APPROVED فقط
  ← لا يوجد كود يُنفّذ الإجراء الفعلي (تحديث القسم/المسمى/الراتب)
  
apps/requests/src/requests/validators/request-details.validator.ts
  السطور 39-42:  TRANSFER يقبل newDepartmentId, newJobTitleId
  السطور 139-167: REWARD يقبل employee list مع rewardType, amount
```

**الحل المطلوب:**
- إضافة handler بعد تغيير الحالة إلى APPROVED يفحص `request.type`:
  - `TRANSFER` → تحديث `departmentId`/`jobTitleId` في users-service
  - `REWARD` → إنشاء سجل مكافأة مرتبط بالراتب القادم
  - أي نوع مالي آخر → تنفيذ الإجراء المناسب

---

#### و) العطل الرسمية لا تُسجَّل تلقائياً في الحضور [جديد]
**الأولوية:** P0  
**الأثر:** أيام العطل الرسمية لا تُعلَّم في سجلات الحضور → تُحسب كغياب → خصم مالي خاطئ.

```
apps/attendance/src/attendance-records/attendance-records.service.ts
  checkIn() السطور 44-135: يفحص WEEKEND فقط (سطر 86-87)، لا يفحص العطل الرسمية
  
apps/attendance/prisma/schema.prisma
  السطر 120: status يشمل 'HOLIDAY' لكنه لا يُستخدم أبداً

apps/leave/prisma/schema.prisma
  Holiday model موجود لكن attendance لا يستعلم عنه
```

**الحل المطلوب:**
- عند checkIn أو عند توليد السجلات اليومية: فحص جدول العطل → تسجيل حالة `HOLIDAY`
- أو: في payroll عند الحساب → استثناء أيام العطل من حساب الغياب

---

### 3.3 خدمة الإجازات (`leave-service`)

#### أ) cancel() بدون فحص ملكية الطلب
**الأولوية:** P1  
**الأثر:** أي موظف يملك permission `leave_requests:cancel` يقدر يلغي إجازة أي موظف آخر.

```
apps/leave/src/leave-requests/leave-requests.service.ts
  السطر 430-484: لا يوجد فحص: request.employeeId !== employeeId
  ← بينما update() سطر 133-135 و submit() سطر 178-180 و remove() سطر 577-579 كلها تفحص الملكية
```

**الحل المطلوب:**
- في `cancel()` إضافة: `if (request.employeeId !== employeeId) throw ForbiddenException`
- في controller تمرير `@EmployeeId()` بدل `@UserId()` لمسار cancel
- أو السماح صراحةً لـ HR بالإلغاء وتوثيق ذلك

---

#### ب) رصيد الإجازات يمكن أن يصبح سالباً (Race Condition) [محدَّث — نطاق أوسع]
**الأولوية:** P1  
**الأثر:** موظف يضغط Submit مرتين → طلبان يُقبلان → رصيد يُخصم مرتين → `remainingDays` سالب.

```
apps/leave/src/leave-requests/leave-requests.service.ts
  المشكلة موجودة في 6 methods وليس فقط submit:
  - submit()          السطرين 201-214
  - approveByManager() السطرين 247-280
  - rejectByManager()  السطرين 300-322
  - approveByHR()      السطرين 350-372
  - rejectByHR()       السطرين 400-422
  - cancel()           السطرين 447-480
  
  لا يوجد prisma.$transaction() في كامل خدمة الإجازات
```

**الحل المطلوب:**
- تغليف كل عملية `update status + updateLeaveBalance` داخل `prisma.$transaction()` في جميع الـ 6 methods

---

#### ج) لا يوجد فحص تداخل تواريخ الإجازات [جديد]
**الأولوية:** P1  
**الأثر:** موظف يقدر يطلب إجازتين متداخلتين بنفس التواريخ → الرصيد يُخصم مرتين.

```
apps/leave/src/leave-requests/leave-requests.service.ts
  create() السطور 77-121: يتحقق فقط من:
  - نوع الإجازة فعّال (82-88)
  - عدد الأيام لا يتجاوز الحد (94-98)
  ← لا يفحص وجود إجازة pending أو approved لنفس الفترة
```

**الحل المطلوب:**
- إضافة استعلام:
  ```
  findFirst({ where: { employeeId, status: { in: ['PENDING_MANAGER','PENDING_HR','APPROVED'] },
    OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate }}] }})
  ```

---

#### د) حساب remainingDays يتجاهل carriedOverDays [جديد]
**الأولوية:** P1  
**الأثر:** موظف عنده رصيد مرحّل 5 أيام + رصيد جديد 20 يوم = 25 يوم. لكن النظام يحسب الرصيد على أساس 20 فقط.

```
apps/leave/src/leave-requests/leave-requests.service.ts
  updateLeaveBalance() السطر 65:
    const newRemainingDays = balance.totalDays - newUsedDays - newPendingDays;
    ← يستخدم totalDays فقط بدون carriedOverDays

apps/leave/src/leave-balances/leave-balances.service.ts
  السطور 183-185: عند إنشاء رصيد جديد مع ترحيل:
    totalDays: balance.leaveType.defaultDays,
    carriedOverDays: balance.remainingDays,
    remainingDays: balance.leaveType.defaultDays + balance.remainingDays  ← صحيح هنا
```

**الحل المطلوب:**
```
const newRemainingDays = (balance.totalDays + balance.carriedOverDays) - newUsedDays - newPendingDays;
```

---

#### هـ) تجاهل قواعد نوع الإجازة عند الإنشاء [جديد]
**الأولوية:** P2  
**الأثر:** حقول `requiresAttachment`, `minDaysNotice`, `allowHalfDay` لا تُفحص.

```
apps/leave/src/leave-requests/leave-requests.service.ts
  create() السطور 77-121: يتحقق فقط من isActive و maxDaysPerRequest
  ← لا يفحص:
    - requiresAttachment: إذا true هل أرفق المرفق؟
    - minDaysNotice: هل الطلب قبل الإجازة بعدد أيام كافٍ؟
    - allowHalfDay: هل الطلب نصف يوم بينما النوع لا يسمح؟
```

**الحل المطلوب:**
- إضافة validations لكل حقل في `create()`

---

### 3.4 خدمة الحضور — باقي المشاكل (`attendance-service`)

#### أ) dailyWorkMinutes ثابت 480 دقيقة لكل الموظفين
**الأولوية:** P1  
**الأثر:** موظف بجدول 6 ساعات → minuteRate يُحسب على 8 ساعات → خصم التأخير والأوفرتايم خاطئان.

```
apps/attendance/src/payroll/payroll.service.ts
  السطر 203: const dailyWorkMinutes = 480; // 8 ساعات افتراضي
```

**الحل المطلوب:**
- جلب `workEndTime - workStartTime` من `employeeSchedule` للموظف
- استخدام الفرق الفعلي بدل الـ 480 الثابت

---

#### ب) deadline التبرير يشمل وقت مراجعة المدير
**الأولوية:** P1  
**الأثر:** الموظف يقدم تبريره في الوقت المحدد، المدير لم يراجعه خلال 24 ساعة من إنشاء التنبيه → يُطبَّق الخصم ظلماً.

```
apps/attendance/src/attendance-justifications/attendance-justifications.service.ts
  السطر 77:  deadline = alert.createdAt + 24h
  السطر 258-271: processExpired يرفض كل تبرير PENDING_MANAGER أو PENDING_HR تجاوز الـ deadline
```

**الحل المطلوب:**
- فصل deadlineين: `employeeDeadline` (24h من التنبيه) و `managerDeadline` (مدة أطول من وقت التقديم)
- `processExpired` يرفض فقط التبريرات التي تجاوزت `managerDeadline`

---

#### ج) create() للسجلات اليدوية بدون فحص التكرار
**الأولوية:** P1  
**الأثر:** HR يمكنها إنشاء سجلي حضور لنفس الموظف في نفس اليوم → بيانات حضور مكررة تُفسد احتساب الراتب.

```
apps/attendance/src/attendance-records/attendance-records.service.ts
  السطر 249-268: create() لا يفحص وجود سجل مسبق لنفس (employeeId + date)
```

**الحل المطلوب:**
- إضافة فحص: `findFirst({ where: { employeeId, date: startOfDay } })` قبل الإنشاء

---

#### د) create() لا يملأ حقول الإدخال اليدوي [جديد]
**الأولوية:** P1  
**الأثر:** لا يمكن معرفة من أنشأ سجل الحضور يدوياً ولماذا — لا audit trail.

```
apps/attendance/src/attendance-records/attendance-records.service.ts
  السطر 249-268: create() لا يملأ isManualEntry, manualEntryBy, manualEntryReason
  
apps/attendance/prisma/schema.prisma
  السطور 149-151: الحقول موجودة في الـ schema لكنها لا تُستخدم
```

**الحل المطلوب:**
- إجبار ملء `manualEntryBy` و `manualEntryReason` عند الإنشاء اليدوي
- تعيين `isManualEntry = true` تلقائياً

---

#### هـ) حالة الموظف المنتهي لا تُفحص عند توليد الراتب [جديد]
**الأولوية:** P1  
**الأثر:** موظفون منتهية خدمتهم (TERMINATED/INACTIVE) يُولَّد لهم كشف راتب شهري كامل.

```
apps/attendance/src/payroll/payroll.service.ts
  السطور 15-20: الاستعلام يفحص فقط deletedAt IS NULL
  ← لا يفحص employmentStatus (ACTIVE, TERMINATED, SUSPENDED, ON_LEAVE)
```

**الحل المطلوب:**
- إضافة `AND e."employmentStatus" = 'ACTIVE'` في الاستعلام
- أو لموظفين مستقيلين خلال الشهر: حساب pro-rata حتى تاريخ الانتهاء

---

#### و) checkIn يقبل تأريخ ماضٍ بدون قيود
**الأولوية:** P2  
**الأثر:** موظف يقدر يسجل حضوره لأيام ماضية عبر `dto.date` → بيانات حضور مزيفة.

```
apps/attendance/src/attendance-records/attendance-records.service.ts
  السطر 44-46: const dateObj = dto.date ? new Date(dto.date) : now;
```

**الحل المطلوب:**
- في `checkIn` و `checkOut` التحقق أن `dateObj` لا يتجاوز اليوم الحالي

---

#### ز) فلترة الأقسام في تقارير الحضور تتم في الذاكرة [محدَّث — نطاق أوسع]
**الأولوية:** P2  
**الأثر:** مع نمو الموظفين، يُجلب كل السجلات من DB ثم يُفلتر في الذاكرة → بطء وعبء على الخادم.

```
apps/attendance/src/reports/reports.service.ts
  المشكلة موجودة في 5 تقارير وليس تقرير واحد:
  - dailyReport()     السطور 57-61
  - monthlyReport()   السطور 111-116
  - summaryReport()   السطور 214-219
  - latenessReport()  السطور 291-293
  - absencesReport()  السطور 352-354
```

**الحل المطلوب:**
- إضافة `WHERE employeeId IN (SELECT id FROM users.employees WHERE departmentId = ?)` في كل الاستعلامات

---

#### ح) أخطاء التقريب في الحسابات المالية [جديد]
**الأولوية:** P2  
**الأثر:** مع مرور الأشهر وتكرار الحساب، تتراكم أخطاء التقريب.

```
apps/attendance/src/payroll/payroll.service.ts
  السطور 208-212:
  - minuteRate يُخزن بـ 4 خانات عشرية (سطر 252)
  - dailyRate يُخزن بـ 2 خانات (سطر 251)
  - كل عملية حسابية وسيطة تُقرَّب بـ toFixed(2) ثم تُستخدم في العملية التالية
```

**الحل المطلوب:**
- تأخير التقريب للخطوة الأخيرة فقط (netSalary)
- أو استخدام مكتبة حساب دقيق (Decimal.js)

---

### 3.5 خدمة الطلبات (`requests-service`)

#### أ) نظامان موازيان للموافقة على نفس الطلب
**الأولوية:** P1  
**الأثر:** HR يمكنها استخدام endpoints القديمة (`/approve-manager`, `/hr-approve`) لتجاوز workflow الموافقة الجديد المبني على `approvalSteps`.

```
apps/requests/src/requests/requests.service.ts
  السطر 149-195: managerApprove / managerReject — لا يمرون عبر ApprovalService
  السطر 199-263: hrApprove / hrReject — نفس المشكلة
  
apps/requests/src/requests/approval.service.ts
  السطر 38-105: approve() — النظام الجديد مع canApprove check
```

**الحل المطلوب:**
- حذف endpoints القديمة (`managerApprove`, `hrApprove`, `managerReject`, `hrReject`) والاعتماد الكامل على `approveStep`/`rejectStep`
- أو إضافة `canApprove` check داخل العمليات القديمة كحل مؤقت

---

#### ب) فقدان transaction في خطوات الموافقة الجديدة [جديد]
**الأولوية:** P1  
**الأثر:** تحديث approval step وتحديث status الطلب عمليتان منفصلتان. لو فشلت الثانية تبقى البيانات غير متسقة.

```
apps/requests/src/requests/approval.service.ts
  السطور 70-85: تحديث approval step ثم تحديث request status بدون transaction
```

**الحل المطلوب:**
- تغليف العمليتين في `prisma.$transaction()`

---

#### ج) endpoints الموافقة الجديدة بدون Permission Guard [جديد]
**الأولوية:** P1  
**الأثر:** `approveStep` و `rejectStep` تعتمدان فقط على `canApprove()` في الكود — لا يوجد Permission decorator كطبقة حماية ثانية.

```
apps/requests/src/requests/requests.controller.ts
  ← approveStep و rejectStep بدون @Permission decorator
  ← الـ endpoints القديمة عندها @Permission لكن الجديدة لا
```

**الحل المطلوب:**
- إضافة `@Permission('requests:approve')` على `approveStep` و `rejectStep`

---

#### د) getPendingMyApproval يجلب كل الطلبات ثم يفلتر
**الأولوية:** P2  
**الأثر:** مع نمو الطلبات، يُجلب كل طلبات `IN_APPROVAL` ثم يُكرر query لكل طلب داخل حلقة → N+1 query problem.

```
apps/requests/src/requests/approval.service.ts
  السطر 182-210:
  const allPending = await this.prisma.request.findMany(...)  ← يجلب كل شيء
  for (const req of allPending) {
    const canApprove = await this.resolver.canApprove(...)   ← 3-4 queries لكل طلب
  }
```

**الحل المطلوب:**
- فلترة `approvalSteps` عبر join مع user permissions في استعلام واحد بدل حلقة N

---

#### هـ) generateRequestNumber قابل للتكرار (Race Condition)
**الأولوية:** P2  
**الأثر:** طلبان يُنشآن في نفس اللحظة → رقم طلب مكرر.

```
apps/requests/src/requests/requests.service.ts
  السطور 45-52: قراءة آخر رقم ثم +1 بدون atomic operation
  ← يوجد unique constraint في DB لكنه يرمي error بدل معالجته
```

**الحل المطلوب:**
- استخدام `SEQUENCE` في PostgreSQL أو إضافة retry logic عند تعارض الـ unique constraint

---

### 3.6 خدمة المستخدمين (`users-service`)

#### أ) roleId filter يرمي خطأ بدل فلترة [محدَّث]
**الأولوية:** P2  
**الأثر:** أي frontend يستخدم `?roleId=...` في قائمة المستخدمين يحصل على خطأ 400.

```
apps/users/src/users/users.service.ts
  السطر 23-29: if (query.roleId) throw new BadRequestException('ROLES_NOT_IMPLEMENTED')
```

> **ملاحظة:** هذا placeholder مقصود (الرسالة تقول "Roles endpoints will be implemented next") وليس bug تقني. لكنه يسبب مشكلة للـ frontend.

**الحل المطلوب:**
- إما تنفيذ الفلترة الفعلية عبر `users.user_roles JOIN users.roles`
- أو إزالة `roleId` من DTO بشكل صريح حتى لا يصل للـ service

---

#### ب) الموظف المحذوف يبقى قابلاً لإنشاء إجازات وسجلات حضور [جديد]
**الأولوية:** P1  
**الأثر:** بعد حذف موظف (soft delete)، يمكن إنشاء طلبات إجازة وسجلات حضور باسمه.

```
apps/leave/src/leave-requests/leave-requests.service.ts
  create() السطور 78-121: لا يفحص إذا الموظف محذوف في users schema
  
apps/attendance/src/attendance-records/attendance-records.service.ts
  create() السطور 249-268: نفس المشكلة
  checkIn() السطر 44: نفس المشكلة
```

**الحل المطلوب:**
- قبل أي عملية إنشاء: فحص `SELECT 1 FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL`

---

### 3.7 خدمة المصادقة (`auth-service`)

#### أ) Login/Refresh بدون DTO validation [محدَّث]
**الأولوية:** P2  
**الأثر:** إرسال `{ "username": null }` يصل للـ service ويولد خطأ غير موحد بدل 400.

```
apps/auth/src/auth/auth.controller.ts
  السطر 18: @Body() body: { username: string; password: string }
  السطر 25: @Body() body: { refreshToken: string }
  ← inline types بدون class-validator

apps/auth/src/main.ts
  ← لا يوجد ValidationPipe مسجّل أصلاً (مقارنة بـ requests-service الذي يسجّله)
```

**الحل المطلوب:**
- إنشاء `LoginDto` و `RefreshDto` مع decorators `@IsString()` و `@IsNotEmpty()`
- إضافة `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` في `main.ts`

---

## 4) المرحلة 1 — توحيد الصلاحيات والتفويض (P1)

### 4.1 Probation endpoints بدون PermissionsGuard

**الأولوية:** P1  
**الأثر:** أي موظف مسجل يقدر يستدعي `senior-approve`, `hr-document`, `ceo-decide` على أي تقييم.

```
apps/evaluation-service/src/probation-evaluations/probation-evaluations.controller.ts
  السطر 9:  @UseGuards(JwtAuthGuard)   ← فقط JWT، لا PermissionsGuard
  السطر 54: @Post(':id/senior-approve') ← بدون permission decorator
  السطر 63: @Post(':id/hr-document')    ← بدون permission decorator
  السطر 72: @Post(':id/ceo-decide')     ← بدون permission decorator
```

**الحل المطلوب:**
- إضافة `PermissionsGuard` إلى controller
- تعريف permissions لكل transition:

| Endpoint | Permission المطلوبة |
|---|---|
| `POST /probation/:id/submit` | `probation:submit` |
| `POST /probation/:id/senior-approve` | `probation:senior-review` |
| `POST /probation/:id/senior-reject` | `probation:senior-review` |
| `POST /probation/:id/hr-document` | `probation:hr-review` |
| `POST /probation/:id/hr-reject` | `probation:hr-review` |
| `POST /probation/:id/ceo-decide` | `probation:ceo-review` |
| `POST /probation/:id/employee-acknowledge` | `probation:acknowledge` |
| `GET /probation/evaluations` (findAll) | `probation:view-all` |

---

### 4.2 Evaluation Forms — تقييم المدير بدون التحقق من العلاقة

**الأولوية:** P1  
**الأثر:** بعد إصلاح بوغ userId/employeeId، أي مدير يملك `evaluation:forms:manage` يقدر يقيّم موظفاً ليس تحته.

```
apps/evaluation-service/src/evaluation-forms/evaluation-forms.service.ts
  السطر 321: if (form.evaluatorId !== user.userId)
```

**الحل المطلوب:** إبقاء الـ check على `form.evaluatorId === user.userId` — هذا كافٍ لأن `evaluatorId` يخزّن `userId` أصلاً.

---

### 4.3 مصفوفة الصلاحيات الكاملة

يجب مراجعة كل endpoint وتوثيق الصلاحية المطلوبة. الأولوية:

| Service | Endpoint | الوضع الحالي | المطلوب |
|---|---|---|---|
| evaluation | `POST /probation/:id/senior-approve` | JwtOnly | PermissionsGuard + permission |
| evaluation | `POST /probation/:id/hr-document` | JwtOnly | PermissionsGuard + permission |
| evaluation | `POST /probation/:id/ceo-decide` | JwtOnly | PermissionsGuard + permission |
| evaluation | `GET /probation/evaluations` | JwtOnly | PermissionsGuard + permission |
| leave | `POST /leave-requests/:id/cancel` | Permission موجودة لكن لا ownership check | إضافة ownership check |
| requests | `POST /requests/:id/approve-manager` | Permission موجودة لكن لا canApprove check | ربط بـ ApprovalService |
| requests | `POST /requests/:id/approve-step` | لا Permission decorator | إضافة Permission + canApprove |
| requests | `POST /requests/:id/reject-step` | لا Permission decorator | إضافة Permission + canApprove |

---

## 5) المرحلة 2 — اختبارات وظيفية مركزة + CI

### المهام
- [ ] كتابة integration tests للتدفقات التالية:
  - [ ] Evaluation: create → self-fill → self-submit → manager-fill → manager-submit → hr-review → gm-approve
  - [ ] Probation: create → submit → senior-approve → hr-document → ceo-decide → employee-acknowledge
  - [ ] Leave: create → submit → manager-approve → hr-approve → cancel (بصلاحيات صحيحة وخاطئة)
  - [ ] Leave: محاولة إنشاء إجازة متداخلة مع إجازة pending → 409
  - [ ] Payroll: generate → verify لكل موظف أن netSalary = basicSalary + allowances + bonuses - deductions - penalties
  - [ ] Payroll: موظف بإجازة معتمدة → التحقق أنها لا تُحسب غياب
  - [ ] Payroll: موظف بمكافأة معتمدة → التحقق أنها تظهر في كشف الراتب
  - [ ] Justification: submit → manager-approve → verify لا خصم / manager-reject → hr-approve → verify لا خصم
  - [ ] Requests: create → submit → approveStep (DIRECT_MANAGER) → approveStep (HR) → APPROVED → التحقق من تنفيذ الإجراء
  - [ ] Requests: محاولة approve بمستخدم ليس الـ manager → 403
  - [ ] Requests: TRANSFER → APPROVED → التحقق أن القسم تغيّر فعلاً
- [ ] تحويل ملفات boilerplate tests إلى اختبارات فعلية أو حذفها
- [ ] توسيع CI matrix للاختبارات الوظيفية على الخدمات الأساسية

### ملفات متوقعة للتعديل
- `.github/workflows/ci.yml`
- `apps/*/src/**/*.spec.ts`
- `apps/*/test/**` (اختبارات integration)

### معايير القبول
- CI يفشل تلقائياً عند كسر أي workflow وظيفي أساسي
- تغطية فعلية للتدفقات المذكورة أعلاه
- لا يتم الدمج إلى main إلا بعد نجاح lint + tests + build

---

## 6) ملخص كل المشاكل المكتشفة

| # | المشكلة | الخدمة | الملف | السطر | الأولوية | الأثر |
|---|---|---|---|---|---|---|
| 1 | خلط userId/employeeId في findOne, saveSelf, submitSelf | evaluation | evaluation-forms.service.ts | 179,198,255 | P0 | التقييم الذاتي مكسور |
| 2 | findPendingMyAction في Probation — يحتاج تحقق من schema | evaluation | probation-evaluations.service.ts | 279 | P0 | workflow التجربة قد يعلق |
| 3 | generateForms بدون evaluatorId | evaluation | evaluation-periods.service.ts | 197-208 | P0 | فورمات بلا مقيّم |
| 4 | تقارير التقييم فارغة دائماً (نتيجة بوغ 1+3) | evaluation | evaluation-reports.service.ts | 19,34,75,120 | P0 | HR بدون بيانات |
| 5 | حساب absentDays/absentUnjustified خاطئ في Payroll | attendance | payroll.service.ts | 96-134 | P0 | راتب مالي خاطئ |
| 6 | خصم تكرار التأخير محسوب لكن لا يُخصم [جديد] | attendance | payroll.service.ts | 141-173, 212 | P0 | لا عقوبة على التأخير المتكرر |
| 7 | لا تكامل مع خدمة الإجازات — الإجازات تُحسب غياب [جديد] | attendance | payroll.service.ts | 106 | P0 | خصم مالي على إجازة معتمدة |
| 8 | لا تكامل مع خدمة الطلبات — المكافآت لا تظهر بالراتب [جديد] | attendance | payroll.service.ts | - | P0 | كشف راتب ناقص |
| 9 | الطلبات المالية (نقل/مكافأة) لا تُنفَّذ بعد الاعتماد [جديد] | requests | requests.service.ts | 199-239 | P0 | workflow بدون نتيجة |
| 10 | العطل الرسمية لا تُسجَّل تلقائياً في الحضور [جديد] | attendance | attendance-records.service.ts | 44-135 | P0 | العطلة تُحسب غياب |
| 11 | Probation endpoints بدون PermissionsGuard | evaluation | probation-evaluations.controller.ts | 9 | P1 | أي موظف يعتمد تقييم CEO |
| 12 | cancel() الإجازة بدون فحص ملكية | leave | leave-requests.service.ts | 430 | P1 | أي موظف يلغي إجازة غيره |
| 13 | رصيد الإجازة بدون transaction في 6 methods | leave | leave-requests.service.ts | متعدد | P1 | رصيد سالب أو مكرر |
| 14 | لا فحص تداخل تواريخ الإجازات [جديد] | leave | leave-requests.service.ts | 77-121 | P1 | إجازات متداخلة |
| 15 | حساب remainingDays يتجاهل carriedOverDays [جديد] | leave | leave-requests.service.ts | 65 | P1 | رصيد إجازات خاطئ |
| 16 | dailyWorkMinutes ثابت 480 لكل الموظفين | attendance | payroll.service.ts | 203 | P1 | خصم/أوفرتايم خاطئ |
| 17 | deadline التبرير يعاقب الموظف ببطء المدير | attendance | attendance-justifications.service.ts | 77, 258-271 | P1 | خصم مالي ظالم |
| 18 | create() سجل حضور بدون فحص تكرار | attendance | attendance-records.service.ts | 249-268 | P1 | سجلات مكررة |
| 19 | create() لا يملأ حقول الإدخال اليدوي [جديد] | attendance | attendance-records.service.ts | 249-268 | P1 | لا audit trail |
| 20 | موظف منتهي الخدمة يُولَّد له راتب [جديد] | attendance | payroll.service.ts | 15-20 | P1 | راتب لموظف منتهي |
| 21 | نظامان موازيان للموافقة (legacy + new) | requests | requests.service.ts | 149-263 | P1 | تجاوز workflow |
| 22 | فقدان transaction في الموافقة الجديدة [جديد] | requests | approval.service.ts | 70-85 | P1 | بيانات غير متسقة |
| 23 | approveStep/rejectStep بدون Permission Guard [جديد] | requests | requests.controller.ts | - | P1 | لا حماية ثانية |
| 24 | موظف محذوف يقبل إجازات وحضور [جديد] | users/leave/attendance | متعدد | - | P1 | بيانات لموظف غير موجود |
| 25 | checkIn يقبل تواريخ ماضية بلا قيود | attendance | attendance-records.service.ts | 44-46 | P2 | بيانات حضور مزيفة |
| 26 | فلترة الأقسام في 5 تقارير تتم في الذاكرة | attendance | reports.service.ts | متعدد | P2 | أداء ضعيف |
| 27 | أخطاء تقريب في الحسابات المالية [جديد] | attendance | payroll.service.ts | 208-212 | P2 | فروقات تراكمية |
| 28 | تجاهل قواعد نوع الإجازة [جديد] | leave | leave-requests.service.ts | 77-121 | P2 | سياسات إجازة غير مطبقة |
| 29 | getPendingMyApproval — N+1 query problem | requests | approval.service.ts | 182-210 | P2 | بطء |
| 30 | generateRequestNumber قابل للتكرار | requests | requests.service.ts | 45-52 | P2 | أرقام مكررة |
| 31 | roleId filter يرمي خطأ (placeholder) | users | users.service.ts | 23-29 | P2 | frontend يتعطل |
| 32 | Login/Refresh بدون DTO + لا ValidationPipe | auth | auth.controller.ts + main.ts | 18,25 | P2 | خطأ غير موحد |

---

## 7) طريقة التسليم للمبرمج

- اعمل التنفيذ على فروع منفصلة:
  - `feature/functional-phase-0` — البنود P0 (1-10): إصلاحات التقييم + الحسابات المالية + التكاملات
  - `feature/permissions-phase-1` — البنود P1 (11-24): الصلاحيات + الملكية + سلامة البيانات
  - `feature/quality-phase-2` — البنود P2 + الاختبارات (25-32)
- كل مرحلة Pull Request مستقل مع checklist الإغلاق
- لا تبدأ المرحلة التالية قبل إغلاق معايير القبول للمرحلة الحالية

---

## 8) معايير القبول الموحدة

### Phase 0 — P0
- [ ] لا توجد أي مقارنة مباشرة بين `employeeId` و `userId` في evaluation-forms (الأماكن الثلاثة: 179, 198, 255)
- [ ] كل evaluation form يحتوي `evaluatorId` صحيح عند الإنشاء
- [ ] تقارير التقييم تُظهر بيانات فعلية بعد اكتمال دورة تقييم واحدة
- [ ] حساب absentUnjustified يعتمد على التبريرات الفعلية فقط
- [ ] خصم تكرار التأخير (repeatLatePenalty) يُخصم فعلياً من netSalary
- [ ] الإجازات المعتمدة لا تُحسب كغياب في الراتب
- [ ] المكافآت والجزاءات المعتمدة تظهر في كشف الراتب وتؤثر على netSalary
- [ ] الطلبات المالية (TRANSFER/REWARD) تُنفَّذ فعلاً بعد الاعتماد
- [ ] العطل الرسمية تُسجَّل بحالة HOLIDAY ولا تُحسب غياب

### Phase 1 — P1
- [ ] كل endpoint في Probation controller يحمل Permission decorator
- [ ] cancel() الإجازة يرفض طلب من ليس صاحب الإجازة بـ 403
- [ ] كل عمليات status + balance في الإجازات ضمن transaction
- [ ] لا يمكن إنشاء إجازة متداخلة مع إجازة pending أو approved
- [ ] حساب remainingDays يشمل carriedOverDays
- [ ] Payroll يستخدم ساعات الدوام الفعلية من جدول الموظف
- [ ] deadline التبرير مفصول عن deadline مراجعة المدير
- [ ] create() سجل الحضور يرفض التكرار بـ 409
- [ ] الإدخال اليدوي يسجّل manualEntryBy و manualEntryReason
- [ ] الموظف المنتهي لا يُولَّد له راتب
- [ ] endpoints القديمة للموافقة محذوفة أو محمية
- [ ] عمليات الموافقة الجديدة ضمن transaction
- [ ] approveStep/rejectStep تحمل Permission decorator
- [ ] لا يمكن إنشاء إجازات أو حضور لموظف محذوف

### Phase 2 — P2
- [ ] checkIn يرفض تواريخ ماضية
- [ ] فلترة الأقسام تتم في SQL وليس الذاكرة (كل التقارير الخمسة)
- [ ] الحسابات المالية تُقرَّب مرة واحدة في النهاية
- [ ] قواعد نوع الإجازة (مرفقات، إشعار مسبق) تُطبَّق
- [ ] `roleId` لا يرمي خطأ runtime
- [ ] Login/Refresh بـ DTO validation + ValidationPipe

---

## 9) التقدير الزمني

| المرحلة | الوصف | عدد البنود | التقدير |
|---|---|---|---|
| Phase 0 | إصلاحات P0 الحرجة (تقييم + مالية + تكاملات) | 10 | 7-10 أيام |
| Phase 1 | إصلاحات P1 (صلاحيات + ملكية + سلامة بيانات) | 14 | 5-8 أيام |
| Phase 2 | إصلاحات P2 + اختبارات + CI | 8 | 4-6 أيام |

**الإجمالي:** من 3 إلى 4 أسابيع

---

## 10) البنود المؤجلة (Security Backlog)

- تدوير `VITASYR_API_KEY` وإزالة أي secret hardcoded/fallback
- تأمين internal endpoints عبر Service-to-Service token
- تضييق CORS وتهيئة Helmet على كل الخدمات الحساسة
- إضافة env validation شامل لكل خدمة
- تنظيف دوري لـ `revoked_tokens`
- تقليل استخدام `$queryRawUnsafe` وتعويضه بـ `$queryRaw` tagged template (تقليل مخاطر SQL injection)
- تأمين periodId/departmentId في raw queries من الإدخال المباشر للمستخدم
- إضافة request correlation logging

---

## ملاحظة

هذا الملف مبني على مراجعة مباشرة للكود المصدري بتاريخ 2026-04-13.  
تم التحقق آلياً من كل بند مقابل الكود الفعلي. البنود الأصلية (18) تم تصحيح 3 منها وتأكيد 15.  
تم اكتشاف 14 بند إضافي جديد (6 منهم P0 حرج).  
كل بند محدد بملف وسطر. يُنصح بإعادة التحقق من الأسطر المذكورة قبل البدء لأن الكود قد يتغير.  
تم تأجيل البنود الأمنية بطلب تنظيمي — يُفضَّل جدولة Security Backlog مباشرة بعد إنهاء هذه النسخة.
