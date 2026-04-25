# مواصفات التعديلات المطلوبة - Backend
**تاريخ:** 2026-04-20  
**المشروع:** منصة إدارة الموارد البشرية - Vitaxir  
**ملاحظة للمبرمج:** هذا الملف يحتوي على جميع التعديلات المطلوبة مرتبة حسب الأولوية. اقرأ كل تعديل كاملاً قبل البدء بالتنفيذ.

---

## التعديل 1 - Dashboard (لوحة التحكم)

### الخدمة: `apps/gateway`

### المطلوب:
إضافة `DashboardModule` في الـ Gateway يحتوي على endpoint واحد يرجع بيانات مختلفة حسب دور المستخدم.

```
GET /dashboard
Authorization: Bearer {token}
```

الـ Gateway يقرأ الـ JWT، يحدد الـ role، ثم يقوم بـ **parallel calls** لكل الخدمات المطلوبة ويجمع النتائج في response واحد.

### البيانات حسب كل دور:

#### الموظف العادي (`EMPLOYEE`)
| البيانات | المصدر |
|---------|--------|
| بيانات الموظف الشخصية (اسم، مسمى وظيفي، قسم، صورة، رقم موظف) | users-service |
| حضوره اليوم (وقت الدخول، الخروج المتوقع) | attendance-service |
| رصيد إجازاته (كل نوع) | leave-service |
| طلباته المعلقة وحالتها | requests-service + leave-service |
| إشعاراته غير المقروءة | users-service |
| وثائقه القريبة من الانتهاء | users-service |
| أهدافه للفترة الحالية | evaluation-service |

#### المدير المباشر (`MANAGER`)
| البيانات | المصدر |
|---------|--------|
| بيانات الموظف الشخصية | users-service |
| طلبات تنتظر موافقته (إجازات + طلبات إدارية + تقييمات) مع العدد | leave-service + requests-service + evaluation-service |
| حضور فريقه اليوم (حاضر / غائب / متأخر) | attendance-service |
| من في إجازة هذا الأسبوع من فريقه | leave-service |
| تنبيهات الفريق (وثائق منتهية، تجارب اقتربت من نهايتها) | users-service |
| تقييمات مفتوحة مطلوبة منه | evaluation-service |

#### HR
| البيانات | المصدر |
|---------|--------|
| بيانات الموظف الشخصية | users-service |
| أرقام سريعة (إجمالي الموظفين، حاضرون اليوم، في إجازة) | users-service + attendance-service + leave-service |
| طلبات في مرحلة HR (إجازات + توظيف + تجارب) مع العدد | leave-service + jobs-service + evaluation-service |
| تنبيهات حرجة (وثائق منتهية، عقود قاربت على الانتهاء، تجارب منتهية بدون تقييم) | users-service + evaluation-service |
| المرشحون في مراحل التوظيف الجاري | jobs-service |
| حالة Payroll هذا الشهر | attendance-service |

#### المدير التنفيذي (`CEO`)
| البيانات | المصدر |
|---------|--------|
| بيانات الموظف الشخصية | users-service |
| موافقات عاجلة في مرحلة CEO (توظيف + تجارب + طلبات) مع العدد | jobs-service + evaluation-service + requests-service |
| المرشحون في المرحلة النهائية | jobs-service |
| تقييمات التجربة في مرحلة CEO | evaluation-service |
| ملخص الشهر (إجازات، غيابات) | leave-service + attendance-service |

#### المدير المالي (`CFO`)
| البيانات | المصدر |
|---------|--------|
| بيانات الموظف الشخصية | users-service |
| حالة Payroll هذا الشهر (تم؟ معلق؟) وإجمالي الرواتب | attendance-service |
| إجمالي الخصومات الشهرية | attendance-service |
| إجمالي البدلات | users-service (EmployeeAllowance) |
| طلبات Overtime المعتمدة هذا الشهر | requests-service |
| طلبات الإجازة غير المدفوعة المعتمدة هذا الشهر | leave-service |

#### المدير العام (`GENERAL_MANAGER`)
| البيانات | المصدر |
|---------|--------|
| بيانات الموظف الشخصية | users-service |
| ملخص الشركة (عدد الموظفين، توزيع حسب القسم) | users-service |
| معدل الحضور هذا الشهر | attendance-service |
| عدد الموظفين الجدد هذا الشهر | users-service |
| الهيكل التنظيمي (شجرة الأقسام) | users-service |

### شكل الـ Response:
```json
{
  "role": "EMPLOYEE",
  "employee": { ... },
  "attendance": { ... },
  "leaveBalance": [ ... ],
  "pendingRequests": [ ... ],
  "notifications": [ ... ],
  "expiringDocuments": [ ... ],
  "goals": [ ... ]
}
```

### ملاحظة مهمة:
كل خدمة تحتاج تضيف endpoint داخلي:
```
GET /dashboard/data?userId={id}&role={role}
```
يُستدعى من الـ Gateway فقط (internal).

---

## التعديل 2 - الراتب الثابت (salaryLinked)

### الخدمة: `apps/attendance-service`

### المطلوب:
التحقق من أن منطق احتساب الـ `MonthlyPayroll` يتحقق من `EmployeeAttendanceConfig.salaryLinked` قبل تطبيق أي خصومات.

### المنطق المطلوب:
```
إذا salaryLinked = false:
  → تجاهل كل حسابات الخصم (التأخير، الغياب، الخروج المبكر)
  → netSalary = basicSalary + allowancesTotal + bonusAmount - penaltyAmount
  
إذا salaryLinked = true:
  → تطبيق DeductionPolicy كالمعتاد
```

### ملاحظة:
`EmployeeAttendanceConfig` و `GET/PUT /attendance/employee-config/:employeeId` موجودون أصلاً. فقط تحقق من أن الـ Payroll service يطبق هذا المنطق عند توليد الراتب الشهري.

---

## التعديل 3 - إشعار HR عند تأخر الموافقة على الإجازة الطبية

### الخدمة: `apps/leave-service`

### المطلوب:
إضافة Cron Job يشتغل **كل ساعة** يتحقق من طلبات الإجازة الطبية التي مضى عليها أكثر من 48 ساعة دون موافقة المدير، ويرسل إشعاراً داخلياً لـ HR.

### التنفيذ:

**1. إضافة المكتبة:**
```bash
npm install @nestjs/schedule
```

**2. المنطق:**
```
كل ساعة:
  اجلب LeaveRequest WHERE:
    - status = PENDING_MANAGER
    - leaveType.code = 'SICK' (أو أي نوع طبي)
    - createdAt < (الآن - 48 ساعة)
    - لم يُرسل إشعار مسبقاً لهذا الطلب
  
  لكل طلب:
    → أرسل إشعار داخلي لكل مستخدم له دور HR
    → نوع الإشعار: LEAVE_REQUEST_PENDING_APPROVAL
    → محتوى: "طلب إجازة طبية [رقم الطلب] للموظف [اسم الموظف] في انتظار الموافقة منذ أكثر من 48 ساعة"
```

**3. لتجنب إرسال الإشعار مرتين:**
أضف حقل على `LeaveRequest`:
```prisma
hrNotifiedAt DateTime? // وقت إرسال الإشعار لـ HR
```

---

## التعديل 4 - تخطي المدير المزدوج في مسار الطلبات

### الخدمة: `apps/requests-service`

### المطلوب:
عند إنشاء طلب جديد وتوليد `ApprovalStep`، إذا كان المدير المباشر للموظف هو نفسه الـ CEO، يتم تخطي خطوة `DIRECT_MANAGER` وتبدأ الموافقة مباشرة من الخطوة التالية.

### المنطق:
```
عند إنشاء طلب:
  1. جلب بيانات الموظف من users-service (directManagerId)
  2. جلب بيانات الـ CEO (المستخدم صاحب role = CEO)
  3. إذا directManagerId == ceoId:
     → تجاهل خطوة ApproverRole.DIRECT_MANAGER
     → ابدأ من الخطوة التالية في ApprovalWorkflow
  4. إذا لا:
     → المسار الطبيعي
```

### ملاحظة:
لا يوجد تغيير على الـ Schema.

---

## التعديل 5 - موافقة الموظف البديل في طلب الإجازة

### الخدمة: `apps/leave-service`

### المطلوب:
تغيير مسار الإجازة ليكون:
```
DRAFT → PENDING_SUBSTITUTE → PENDING_MANAGER → PENDING_HR → APPROVED/REJECTED
```

### تغييرات الـ Schema:

**1. إضافة status جديد للـ enum:**
```prisma
enum LeaveRequestStatus {
  DRAFT
  PENDING_SUBSTITUTE  // ← جديد
  PENDING_MANAGER
  PENDING_HR
  APPROVED
  REJECTED
  CANCELLED
}
```

**2. إضافة حقول على `LeaveRequest`:**
```prisma
substituteStatus     String?   // PENDING, APPROVED, REJECTED
substituteApprovedAt DateTime?
substituteNotes      String?
```

### المنطق:
```
عند تقديم الطلب:
  إذا substituteId موجود:
    → status = PENDING_SUBSTITUTE
    → إرسال إشعار داخلي للموظف البديل
  إذا لا:
    → status = PENDING_MANAGER (المسار القديم)

عند موافقة البديل:
  → status = PENDING_MANAGER
  → إشعار للمدير

عند رفض البديل:
  → status = REJECTED
  → إشعار للموظف بأن البديل رفض
```

---

## التعديل 6 - مسار التوظيف الجديد + تقييم المقابلة

### الخدمة: `apps/jobs-service`

### 6.1 - تعديل `InterviewEvaluation`:

**إضافة حقلين:**
```prisma
model InterviewEvaluation {
  // ... الحقول الموجودة ...
  additionalConditions    String?   // شروط إضافية
  salaryAfterConfirmation Float?    // الراتب بعد التثبيت
  // proposedSalary موجود أصلاً ✓
}
```

### 6.2 - تعديل `CandidateStage` enum:

**استبدال المراحل القديمة بالجديدة:**
```prisma
enum CandidateStage {
  // حذف القديمة: NEW, INITIAL_REVIEW, PHONE_INTERVIEW, TECHNICAL_INTERVIEW, FINAL_INTERVIEW, OFFER_SENT, WITHDRAWN
  // إضافة الجديدة:
  PENDING                  // معلق
  ELIGIBLE_FOR_INTERVIEW   // مؤهل للمقابلة - يقوم بها HR
  FINAL_ELIGIBLE           // مؤهل نهائي - يقوم بها HR
  CEO_APPROVAL             // موافقة المدير التنفيذي
  REFERENCE_CHECK          // مرحلة الاتصال بالمراجع - يقوم بها HR
  HIRED                    // تم التوظيف
  REJECTED                 // مرفوض (مع سبب - rejectionReason موجود أصلاً ✓)
}
```

**⚠️ تنبيه Migration:** احذف أو حوّل أي بيانات موجودة بالمراحل القديمة قبل تغيير الـ enum.

### 6.3 - إضافة بيانات المراجع على `Candidate`:

```prisma
model Candidate {
  // ... الحقول الموجودة ...
  reference1Name  String?
  reference1Phone String?
  reference2Name  String?
  reference2Phone String?
}
```

### 6.4 - إضافة model جديد `CandidateReferenceCheck`:

```prisma
model CandidateReferenceCheck {
  id                   String    @id @default(uuid())
  candidateId          String    @unique
  reference1ReportUrl  String?   // تقرير HR بعد الاتصال بالمرجع الأول
  reference2ReportUrl  String?   // تقرير HR بعد الاتصال بالمرجع الثاني
  notes                String?
  checkedBy            String    // HR userId
  checkedAt            DateTime  @default(now())
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  candidate Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)

  @@map("candidate_reference_checks")
  @@schema("jobs")
}
```

### 6.5 - مسار الموافقة الجديد:

| المرحلة | من يتصرف | الإجراء |
|---------|---------|---------|
| `PENDING` | HR | يقرر التأهيل للمقابلة |
| `ELIGIBLE_FOR_INTERVIEW` | HR | يؤكد التأهيل النهائي |
| `FINAL_ELIGIBLE` | CEO | يوافق أو يرفض |
| `CEO_APPROVAL` | HR | يتصل بالمراجع ويرفع التقارير |
| `REFERENCE_CHECK` | HR | يضع `HIRED` أو `REJECTED` |

### 6.6 - ملاحظة حول `JobOffer`:
يبقى الـ model في الـ Schema لكن **لا يُستخدم** في المسار الجديد. معلومات الراتب أصبحت في `InterviewEvaluation`.

---

## التعديل 7 - تقارير Excel للعهدة وتحديث التقارير الحالية

### الخدمة: `apps/users-service`

### المطلوب:

**1. استبدال CSV بـ Excel في كل التقارير الموجودة:**
```bash
npm install exceljs
```

استبدل `sendCsv` utility بـ `sendExcel` في جميع endpoints في `hr-reports.controller.ts`:
- `GET /reports/hr/employees-summary`
- `GET /reports/hr/turnover`
- `GET /reports/hr/salaries`
- `GET /reports/hr/expiry-dates`

الـ query param يبقى نفسه: `?format=excel` (بدل `csv`)

**2. إضافة تقرير العهدة:**

endpoint جديد:
```
GET /reports/hr/custodies?format=excel&status=ACTIVE|RETURNED|ALL&departmentId=...
```

أعمدة التقرير:
| العمود |
|-------|
| رقم الموظف |
| اسم الموظف |
| القسم |
| اسم العهدة |
| الفئة (Category) |
| تاريخ الاستلام |
| الحالة (نشط / مُرجع) |
| تاريخ الإرجاع |
| ملاحظات |

---

## التعديل 8 - مسار تقييم فترة التجربة (Probation)

### الخدمة: `apps/evaluation-service`

### المطلوب:
إضافة مرحلة جدولة الاجتماع بعد موافقة الـ CEO.

### تعديل `ProbationStatus` enum:
```prisma
enum ProbationStatus {
  DRAFT
  PENDING_SENIOR_MANAGER
  PENDING_HR
  PENDING_CEO
  PENDING_MEETING_SCHEDULE  // ← جديد: HR يجدول الاجتماع
  COMPLETED
  REJECTED_BY_SENIOR
  REJECTED_BY_HR
  REJECTED_BY_CEO
}
```

### إضافة حقول على `ProbationEvaluation`:
```prisma
model ProbationEvaluation {
  // ... الحقول الموجودة ...
  
  // حقول الاجتماع
  meetingProposedAt           DateTime?  // HR يقترح الموعد
  meetingConfirmedByEmployee  Boolean    @default(false)
  meetingConfirmedByManager   Boolean    @default(false)
  meetingConfirmedAt          DateTime?  // عند موافقة الطرفين
  decisionDocumentUrl         String?    // وثيقة القرار بعد الاجتماع
}
```

### إضافة قيمة للـ `ProbationRecommendation`:
```prisma
enum ProbationRecommendation {
  EXTEND_PROBATION
  CONFIRM_POSITION
  TRANSFER_POSITION
  SALARY_RAISE      // ← جديد: رفع الراتب
  TERMINATE
}
```

### مسار الاجتماع:
```
CEO يوافق → status = PENDING_MEETING_SCHEDULE
  ↓
HR يحدد meetingProposedAt
  ↓
الموظف يؤكد → meetingConfirmedByEmployee = true
المدير يؤكد → meetingConfirmedByManager = true
  ↓
عند تأكيد الطرفين → meetingConfirmedAt = now()
  ↓
HR يرفع وثيقة القرار → decisionDocumentUrl
  ↓
HR يغلق التقييم → status = COMPLETED
```

---

## التعديل 9 - الهيكل التنظيمي

### الخدمة: `apps/gateway`

### المطلوب:
التحقق فقط من أن endpoint الشجرة مكشوف بالـ Gateway:

```
GET /departments/tree
```

هذا الـ endpoint موجود أصلاً في `departments.service.ts` (`getTree()`). فقط تأكد أنه مضاف في routing الـ Gateway.

---

## التعديل 10 - إرسال رسالة رفض للمرشح

### الخدمة: `apps/jobs-service`

### المطلوب:
عند تغيير `currentStage` للمرشح إلى `REJECTED`، يُرسل تلقائياً إيميل رفض لعنوان بريده الإلكتروني.

### 10.1 - إضافة Mailer:
```bash
npm install @nestjs-modules/mailer nodemailer
npm install -D @types/nodemailer
```

### 10.2 - إعدادات SMTP في `.env`:
```env
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=hr@vitaxirpro.com
MAIL_PASS=your_password_here
MAIL_FROM="فريق الموارد البشرية - فيتاكسير <hr@vitaxirpro.com>"
```

### 10.3 - قالب الإيميل:

**Subject:** نتيجة طلب التوظيف - {jobTitle}

**Body:**
```
السيد/ السيدة {candidateName}،

السلام عليكم ورحمة الله وبركاته،

نشكركم على تخصيص وقتكم للمشاركة في مقابلة التقديم للوظيفة [{jobTitle}] في شركة فيتاكسير.

لقد كان من دواعي سرورنا التعرف على خبراتكم وإنجازاتكم المتميزة.

نقدر عالياً المستوى الاحترافي الذي أبديتموه خلال المقابلة، ولكن بعد دراسة متأنية من قبل فريقنا، نأسف لإعلامكم بأننا قد قررنا المضي قدماً مع مرشح آخر تتطابق خبراته بشكل أكبر مع متطلبات المرحلة الحالية للمنصب.

هذا القرار لم يكن سهلاً، ونود التأكيد على أننا نتمنى لكم كل النجاح والتوفيق في مسيرتكم المهنية. سنحتفظ بسيرتكم الذاتية في قاعدة بياناتنا للوظائف المستقبلية التي قد تتناسب مع مهاراتكم المميزة.

شاكرين لكم حسن تعاونكم وتفهمكم.

مع خالص التحية والتقدير،
فريق الموارد البشرية
شركة فيتاكسير
```

### 10.4 - المتغيرات الديناميكية:
| المتغير | المصدر |
|---------|--------|
| `{candidateName}` | `Candidate.firstNameAr + ' ' + Candidate.lastNameAr` |
| `{jobTitle}` | `InterviewPosition.jobTitle` |

### 10.5 - التنفيذ:
في `candidates.service.ts` عند تغيير stage إلى `REJECTED`:
```typescript
if (newStage === CandidateStage.REJECTED && candidate.email) {
  await this.mailService.sendRejectionEmail(candidate, position);
}
```

---

## ملخص التعديلات

| # | التعديل | الخدمة | Schema يتغير؟ | صعوبة |
|---|---------|--------|:------------:|-------|
| 1 | Dashboard | gateway | ❌ | عالية |
| 2 | Salary Linked | attendance | ❌ | منخفضة |
| 3 | إشعار طبي 48h | leave | ✅ (حقل واحد) | متوسطة |
| 4 | تخطي المدير المزدوج | requests | ❌ | منخفضة |
| 5 | موافقة الموظف البديل | leave | ✅ | متوسطة |
| 6 | مسار التوظيف | jobs | ✅ | عالية |
| 7 | تقارير Excel + العهدة | users | ❌ | متوسطة |
| 8 | مسار التجربة | evaluation | ✅ | متوسطة |
| 9 | الهيكل التنظيمي | gateway | ❌ | منخفضة |
| 10 | رسالة رفض المرشح | jobs | ❌ | منخفضة |
