# دليل الدمج النهائي

## عنوان الدليل
دمج الحالة النهائية لنظام الطلبات الإدارية ونظام طلبات الإجازات

## التاريخ
2026-04-14

## الهدف
هذا الدليل مخصص لمبرمج الباك إند لتنفيذ الدمج النهائي بشكل آمن ومنظم، بدون أي غموض، مع توحيد:
- المخطط النهائي في Prisma Schema
- سلسلة الاعتمادات النهائية
- الصلاحيات النهائية
- التوافق بين الكود وبيانات الصلاحيات والمهاجرات

هذا الدليل يحدد ما الذي يجب تعديله، وما الذي يجب حذفه لاحقا، وما الذي يجب إبقاؤه مؤقتا للتوافق الخلفي.

---

## 0) تنبيه حرج قبل البدء (Read First)

هذا الدليل **يُلغي أثر** آخر التزامين على main بتاريخ 2026-04-14:

- `49b5fae feat(requests): add PERMISSION/ADVANCE/JOB_CHANGE/RIGHTS/SPONSORSHIP request types`
- `abe6af3 feat(requests): add PERMISSION/ADVANCE/JOB_CHANGE/RIGHTS/SPONSORSHIP to request DTO`

هذان الالتزامان أعادا الأنواع الخمسة التالية إلى schema و DTO:
- PERMISSION
- ADVANCE
- JOB_CHANGE
- RIGHTS
- SPONSORSHIP

**القرار النهائي المعتمد**: هذه الأنواع الخمسة **مرفوضة نهائيا**. المطلوب إعادة `apps/requests/prisma/schema.prisma` و `apps/requests/src/requests/dto/create-request.dto.ts` إلى حالة 11 نوعا فقط (مطابقة لـ commit `d1395f6`).

لو فتحت الريبو اليوم ستجد 16 نوعا في schema و DTO — هذا وضع مؤقت يجب تصحيحه ضمن هذا الدليل. لا تظن أن الدليل قديم.

ملاحظة: migration `20260324000001_remove_request_types` ما زالت في مكانها وتحذف الأنواع الخمسة من DB، لذلك schema/DTO الحاليان في drift فعلي مع DB — هذا الدليل يُنهي ذلك الـ drift.

---

## 1) نطاق المراجعة المعتمد في هذا الدليل
تمت مراجعة الملفات التنفيذية الأساسية التالية قبل إعداد هذا الدليل:

- apps/requests/prisma/schema.prisma
- apps/requests/prisma/migrations/20260115000001_init_requests/migration.sql
- apps/requests/prisma/migrations/20260316000002_approval_system/migration.sql
- apps/requests/prisma/migrations/20260324000001_remove_request_types/migration.sql
- apps/requests/src/requests/requests.controller.ts
- apps/requests/src/requests/requests.service.ts
- apps/requests/src/requests/approval.service.ts
- apps/requests/src/requests/approval-resolver.service.ts
- apps/requests/src/requests/dto/create-request.dto.ts
- apps/requests/src/requests/validators/request-details.validator.ts
- apps/users/prisma/seed.ts
- apps/users/prisma/migrations/20260316000002_requests_permissions/migration.sql
- packages/shared/src/constants/permissions.constants.ts
- apps/leave/src/leave-requests/leave-requests.controller.ts
- apps/leave/src/leave-requests/leave-requests.service.ts
- apps/leave/prisma/schema.prisma

---

## 2) الملخص التنفيذي

### الحالة العامة
- نظام الطلبات الإدارية يحتوي بنية اعتماد ديناميكية جيدة (approval_workflows + approval_steps).
- خدمة الإجازات مستقرة نسبيا بمسار مدير ثم HR حسب نوع الإجازة.

### أهم فجوات الدمج الحالية
1. عدم تطابق RequestType بين schema الحالي وبين الناتج النهائي للمهاجرات.
2. عدم تطابق الصلاحيات بين seed.ts وبين migration الصلاحيات الجديدة.
3. ثوابت الصلاحيات المشتركة لا تعكس الصلاحيات الديناميكية الجديدة.
4. وجود endpoints قديمة وجديدة معا في الطلبات الإدارية (بحاجة قرار نهائي).

### النتيجة المطلوبة بعد الدمج
- مصدر حقيقة واحد للحالة النهائية في schema والكود.
- مسارات اعتماد موحدة ومفهومة.
- صلاحيات متسقة في:
  - users migration
  - users seed
  - shared constants
  - controller decorators

---

## 3) الحالة النهائية المعتمدة للطلبات الإدارية

## 3.1 أنواع الطلبات النهائية المطلوبة
الأنواع النهائية المعتمدة:

- TRANSFER
- RESIGNATION
- REWARD
- OTHER
- PENALTY_PROPOSAL
- OVERTIME_EMPLOYEE
- OVERTIME_MANAGER
- BUSINESS_MISSION
- DELEGATION
- HIRING_REQUEST
- COMPLAINT

الأنواع التي يجب أن تعتبر ملغاة نهائيا:

- PERMISSION
- ADVANCE
- JOB_CHANGE
- RIGHTS
- SPONSORSHIP

ملاحظة مهمة:
migration رقم 20260324000001_remove_request_types يثبت هذا الإلغاء، لذلك schema و DTO يجب أن يتطابقا معه.

## 3.2 حالات الطلب النهائية

- DRAFT
- IN_APPROVAL
- PENDING_MANAGER
- PENDING_HR
- APPROVED
- REJECTED
- CANCELLED

ملاحظة:
في النظام الديناميكي الفعلي، المسار الأساسي يعتمد على IN_APPROVAL. الحالات PENDING_MANAGER و PENDING_HR بقيت للتوافق والسيناريوهات القديمة.

## 3.3 أدوار الاعتماد النهائية

- DIRECT_MANAGER
- DEPARTMENT_MANAGER
- TARGET_MANAGER
- HR
- CEO
- CFO

## 3.4 مصفوفة الاعتماد النهائية (Administrative Requests)

| نوع الطلب | تسلسل الاعتماد النهائي |
|---|---|
| RESIGNATION | DIRECT_MANAGER -> HR |
| TRANSFER | DIRECT_MANAGER -> HR |
| REWARD | DIRECT_MANAGER -> HR -> CEO |
| OTHER | DIRECT_MANAGER |
| PENALTY_PROPOSAL | DIRECT_MANAGER -> HR -> CEO |
| OVERTIME_EMPLOYEE | DIRECT_MANAGER -> HR |
| OVERTIME_MANAGER | HR -> CEO |
| BUSINESS_MISSION | DIRECT_MANAGER -> HR -> CEO |
| DELEGATION | DIRECT_MANAGER -> TARGET_MANAGER -> HR |
| HIRING_REQUEST | DEPARTMENT_MANAGER -> HR -> CEO |
| COMPLAINT | HR -> CEO |

---

## 4) الحالة النهائية المعتمدة لطلبات الإجازات

المسار التشغيلي الحالي المعتمد:

- إنشاء الطلب: DRAFT
- submit: DRAFT -> PENDING_MANAGER
- manager approve:
  - إذا leaveType.requiresApproval = true -> PENDING_HR
  - إذا leaveType.requiresApproval = false -> APPROVED
- HR approve: PENDING_HR -> APPROVED
- manager reject أو HR reject -> REJECTED
- cancel (حسب الحالة) -> CANCELLED

الصلاحيات المعتمدة في الإجازات:

- leave_requests:create
- leave_requests:update
- leave_requests:submit
- leave_requests:approve_manager
- leave_requests:approve_hr
- leave_requests:cancel
- leave_requests:read
- leave_requests:read_all
- leave_requests:delete

---

## 5) الفروقات الحالية المطلوب دمجها (ملف بملف)

## 5.1 apps/requests/prisma/schema.prisma
الوضع الحالي:
- ما زال يحتوي أنواع ملغاة: PERMISSION, ADVANCE, JOB_CHANGE, RIGHTS, SPONSORSHIP.

المطلوب:
- حذف الأنواع الملغاة من enum RequestType.
- إبقاء الأنواع النهائية 11 فقط.

الأثر:
- توحيد schema مع migration النهائية.

## 5.2 apps/requests/src/requests/dto/create-request.dto.ts
الوضع الحالي:
- enum RequestType في DTO ما زال يحتوي الأنواع الملغاة.

المطلوب:
- إزالة نفس الأنواع الملغاة لتطابق schema النهائية.

الأثر:
- منع إدخال API payload بأنواع غير موجودة فعليا في DB.

## 5.3 apps/users/prisma/seed.ts
الوضع الحالي:
- يحتوي الصلاحيات القديمة:
  - requests:manager-approve
  - requests:manager-reject
  - requests:hr-approve
  - requests:hr-reject
- لا يحتوي الصلاحيات الجديدة الموجودة في migration الصلاحيات.

المطلوب:
- إضافة صلاحيات النظام الجديد:
  - requests:approve
  - requests:reject
  - requests:ceo-approve
  - requests:cfo-approve
  - requests:read-all-steps
  - requests:manage-workflows
- قرار مرحلي:
  - إبقاء الصلاحيات القديمة مؤقتا للتوافق الخلفي إذا لم يتم حذف endpoints القديمة فورا.

تنبيه مهم (صلاحيات ناقصة من migration):
- الصلاحيات التالية موجودة حاليا **فقط في seed.ts** ولا توجد في أي migration:
  - requests:manager-approve
  - requests:manager-reject
  - requests:hr-reject
- النتيجة: أي بيئة تُشغَّل فيها migrations بدون seed (CI/CD، بيئة اختبار نظيفة، production migration-only) ستفشل فيها endpoints القديمة بـ 403 لأن الصلاحية غير موجودة.
- المطلوب: بما أننا نُبقي endpoints القديمة مؤقتا (انظر القسم 11 القرار 2)، يجب إضافة هذه الصلاحيات الثلاث إلى migration صلاحيات جديدة (أو تمديد migration `20260316000002_requests_permissions` بـ migration تكميلية)، أو ضمان تشغيل seed.ts في كل البيئات.

## 5.4 packages/shared/src/constants/permissions.constants.ts
الوضع الحالي:
- REQUESTS constants لا تعكس الصلاحيات الديناميكية الجديدة.

المطلوب:
- إضافة constants للصلاحيات الجديدة.
- في حال الحذف النهائي للنظام القديم: إزالة constants القديمة.

## 5.5 apps/requests/src/requests/requests.controller.ts
الوضع الحالي:
- يحتوي النظام الجديد:
  - POST :id/approve (requests:approve)
  - POST :id/reject (requests:approve)
- ويحتوي أيضا endpoints قديمة:
  - manager-approve / manager-reject
  - hr-approve / hr-reject

ملاحظة حرجة:
- endpoint الرفض الجديد يستخدم requests:approve حاليا وليس requests:reject.
- يجب حسم هذا التباين: إما اعتماد permission واحدة للموافقة والرفض، أو تعديل reject endpoint لاستخدام requests:reject ثم توحيد ذلك في seed والثوابت والتوثيق.

المطلوب (قرار معماري واضح):

الخيار A (مرحلي آمن):
- إبقاء القديمة مؤقتا لفترة انتقالية.
- توثيقها كـ Deprecated.
- التأكد أن service يحولها فعليا إلى approvalService (وهو موجود حاليا).

الخيار B (النهاية النظيفة الموصى بها):
- حذف endpoints القديمة بالكامل.
- اعتماد approve/reject الديناميكي فقط.
- حذف صلاحيات manager/hr القديمة من seed/constants لاحقا.

## 5.6 apps/requests/prisma/migrations/*
الوضع الحالي:
- توجد مهاجرات تاريخية متسلسلة فيها إضافة أنواع ثم حذفها لاحقا.

المطلوب:
- في بيئات قائمة: تنفيذ السلسلة كما هي بدون تعديل التاريخ.
- في بيئة جديدة/نسخة نظيفة: يوصى بعمل baseline migration موحد نهائي لتقليل التعقيد.

---

## 6) تفاصيل الاعتماد النهائي (منطق التنفيذ)

## 6.1 منطق صلاحية الموافقة في الطلبات الإدارية
الموافقة الفعلية تعتمد على عنصرين:

1) صلاحية endpoint على مستوى controller
2) فحص canApprove داخل ApprovalResolverService حسب الدور الحالي للخطوة

القواعد الحالية في resolver:
- DIRECT_MANAGER: يجب أن يطابق managerId للموظف
- DEPARTMENT_MANAGER: مدير قسم الموظف
- TARGET_MANAGER: مدير القسم الهدف من details.newDepartmentId
- HR: يتطلب requests:hr-approve
- CEO: يتطلب requests:ceo-approve
- CFO: يتطلب requests:cfo-approve

## 6.2 تدفق الاعتماد في الطلبات الإدارية

- submit:
  - يجلب workflow حسب النوع
  - ينشئ approval steps
  - يحول الطلب إلى IN_APPROVAL
- approve:
  - يعتمد الخطوة الحالية
  - ينقل currentStepOrder للخطوة التالية
  - أو يغلق الطلب APPROVED عند آخر خطوة
- reject:
  - يرفض الخطوة الحالية
  - يغلق الطلب REJECTED

المعاملات:
- approve/reject يستخدمان transaction لتحديث approval step + request status بشكل ذري.

---

## 7) SQL مرجعي مقترح لإعادة تهيئة approval_workflows بالحالة النهائية

ملاحظة:
هذا SQL مرجعي فقط لمبرمج الباك إند عند الحاجة لإعادة seed نظيفة. لا ينفذ كما هو في هذا الدليل.

~~~sql
SET search_path TO requests;

DELETE FROM approval_workflows;

INSERT INTO approval_workflows (id, "requestType", "stepOrder", "approverRole") VALUES
  (gen_random_uuid()::text, 'RESIGNATION',      1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'RESIGNATION',      2, 'HR'),

  (gen_random_uuid()::text, 'TRANSFER',         1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'TRANSFER',         2, 'HR'),

  (gen_random_uuid()::text, 'REWARD',           1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'REWARD',           2, 'HR'),
  (gen_random_uuid()::text, 'REWARD',           3, 'CEO'),

  (gen_random_uuid()::text, 'OTHER',            1, 'DIRECT_MANAGER'),

  (gen_random_uuid()::text, 'PENALTY_PROPOSAL', 1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'PENALTY_PROPOSAL', 2, 'HR'),
  (gen_random_uuid()::text, 'PENALTY_PROPOSAL', 3, 'CEO'),

  (gen_random_uuid()::text, 'OVERTIME_EMPLOYEE',1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'OVERTIME_EMPLOYEE',2, 'HR'),

  (gen_random_uuid()::text, 'OVERTIME_MANAGER', 1, 'HR'),
  (gen_random_uuid()::text, 'OVERTIME_MANAGER', 2, 'CEO'),

  (gen_random_uuid()::text, 'BUSINESS_MISSION', 1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'BUSINESS_MISSION', 2, 'HR'),
  (gen_random_uuid()::text, 'BUSINESS_MISSION', 3, 'CEO'),

  (gen_random_uuid()::text, 'DELEGATION',       1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'DELEGATION',       2, 'TARGET_MANAGER'),
  (gen_random_uuid()::text, 'DELEGATION',       3, 'HR'),

  (gen_random_uuid()::text, 'HIRING_REQUEST',   1, 'DEPARTMENT_MANAGER'),
  (gen_random_uuid()::text, 'HIRING_REQUEST',   2, 'HR'),
  (gen_random_uuid()::text, 'HIRING_REQUEST',   3, 'CEO'),

  (gen_random_uuid()::text, 'COMPLAINT',        1, 'HR'),
  (gen_random_uuid()::text, 'COMPLAINT',        2, 'CEO');
~~~

---

## 8) خطة تنفيذ الدمج المقترحة (Step-by-step)

## المرحلة 1: توحيد المخطط والـ DTO

1. تعديل enum RequestType في schema إلى 11 نوع نهائي.
2. تعديل enum RequestType في create-request.dto.ts لنفس الأنواع.
3. مراجعة أي DTO أو validation تعتمد الأنواع الملغاة.
4. تشغيل prisma generate والتأكد من نجاح build.

## المرحلة 2: توحيد الصلاحيات

1. تحديث seed.ts بإضافة صلاحيات النظام الجديد.
2. تحديث shared permission constants لنفس الأسماء.
3. مراجعة ربط الصلاحيات مع الأدوار الفعلية (HR/CEO/CFO/Managers).

## المرحلة 3: حسم الواجهات القديمة

1. القرار النهائي: إبقاء endpoints القديمة مؤقتا أو حذفها.
2. في حالة الحذف:
   - حذف endpoints القديمة من controller.
   - حذف صلاحياتها القديمة من constants والseed لاحقا.
   - تحديث الواجهة الأمامية والتوثيق.

## المرحلة 4: التحقق والتوثيق

1. التأكد أن submit ينشئ approvalSteps صحيحة لكل نوع.
2. التأكد أن approve/reject يعملان حسب currentStepOrder.
3. التأكد أن transition النهائي للحالات صحيح.
4. تحديث وثائق API وPermissions بعد الحسم.

---

## 9) حالات اختبار قبول إلزامية بعد الدمج

## 9.1 Administrative Requests
- إنشاء طلب لكل نوع من الأنواع 11.
- submit -> التأكد من توليد خطوات الاعتماد الصحيحة.
- approve لكل خطوة حتى الإغلاق النهائي.
- reject في أي خطوة -> الحالة النهائية REJECTED.
- التحقق من منع مستخدم غير مخول من اعتماد الخطوة.

## 9.2 Permissions
- مستخدم لديه requests:approve بدون requests:hr-approve لا يجب أن يمر في خطوة HR.
- مستخدم HR مع requests:hr-approve يمر في خطوات HR فقط.
- مستخدم CEO/CFO يمر فقط في خطواته.

## 9.3 Leave Requests
- submit يحجز pendingDays عند توفر balance.
- manager approve ينقل إلى PENDING_HR أو APPROVED حسب requiresApproval.
- HR approve يثبت usedDays ويولد سجلات ON_LEAVE.
- cancel يعيد التوازن الصحيح للرصيد حسب الحالة السابقة.

---

## 10) ملاحظات مهمة للمبرمج قبل التنفيذ

1. لا تحذف migrations القديمة مباشرة في بيئة منتجة دون خطة تفريغ/إعادة baseline مدروسة.
2. إذا تم اعتماد baseline جديد، يجب توثيق طريقة ترحيل قواعد البيانات الحالية.
3. أي تغيير في أسماء الصلاحيات يجب أن يتبعه تحديث شامل في:
   - seed
   - constants
   - decorators
   - roles mapping
   - frontend permissions checks
4. الأفضل إنهاء الانتقال إلى النظام الديناميكي بالكامل وإلغاء endpoints القديمة بعد فترة توافق محددة زمنيا.

---

## 11) القرارات المحسومة

**القرار 1 (محسوم): أنواع الطلبات**
- 11 نوعا فقط كما هو محدد في القسم 3.1.
- الأنواع الخمسة PERMISSION, ADVANCE, JOB_CHANGE, RIGHTS, SPONSORSHIP **ملغاة نهائيا** ويجب إزالتها من schema و DTO (انظر القسم 0 للتنبيه حول commits الحديثة التي أعادتها).

**القرار 2 (محسوم): Endpoints والصلاحيات القديمة**
- إبقاء endpoints القديمة (`manager-approve`, `manager-reject`, `hr-approve`, `hr-reject`) مؤقتا للتوافق الخلفي.
- إبقاء الصلاحيات القديمة (`requests:manager-approve`, `requests:manager-reject`, `requests:hr-approve`, `requests:hr-reject`) في seed.ts و constants.
- حذف هذه الـ endpoints والصلاحيات **يؤجَّل لدورة لاحقة** بعد انتقال الفرونت إند بالكامل إلى `approve`/`reject` الديناميكيين.
- مطلوب في هذه الدورة: إضافة الصلاحيات الجديدة فقط (انظر القسم 5.3)، بدون حذف القديمة.

هذان القراران نهائيان ولا يحتاجان مراجعة إضافية من الجهة الطالبة.

---

## 12) تعريف نجاح الدمج

يعتبر الدمج ناجحا عند تحقق كل ما يلي:

- schema يعكس الأنواع النهائية فقط.
- DTO يطابق schema بدون أنواع ميتة.
- approval workflows متوافقة مع الأنواع النهائية فقط.
- الصلاحيات متسقة بين migration وseed وconstants وcontroller.
- اختبارات الاعتماد تمر لجميع الأنواع النهائية.
- توثيق API والصلاحيات محدث ومطابق للتنفيذ.

---

نهاية الدليل.
