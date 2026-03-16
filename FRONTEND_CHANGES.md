# Frontend Implementation Guide — Backend Modifications

> هذا الملف يوضح بالضبط التغييرات المطلوبة من الفرونت بناءً على التعديلات المُنفَّذة في الباكند.

---

## 1. الكودات التلقائية (Auto-Generated Codes)

### ما الذي تغيّر؟

جميع حقول الكود/الرقم التالية أصبحت **اختيارية** — الباكند يولّدها تلقائياً إذا لم ترسلها:

| الكيان | الحقل | النمط التلقائي | مثال |
|---|---|---|---|
| القسم (Department) | `code` | `VTX-DEP-XXXXXX` | `VTX-DEP-000001` |
| الدرجة الوظيفية (Job Grade) | `code` | `VTX-GRD-XXXXXX` | `VTX-GRD-000001` |
| المسمى الوظيفي (Job Title) | `code` | `VTX-JTL-XXXXXX` | `VTX-JTL-000001` |
| الموظف (Employee) | `employeeNumber` | `VTX-EMP-XXXXXX` | `VTX-EMP-000001` |
| فترة التقييم (Evaluation Period) | `code` | `VTX-EVL-XXXXXX` | `VTX-EVL-000001` |
| الطلب الإداري (Request) | `requestNumber` | `VTX-LRQ-XXXXXX` | `VTX-LRQ-000001` |
| جدول الدوام (Work Schedule) | `code` | `VTX-ATT-XXXXXX` | `VTX-ATT-000001` |

### ماذا يعني هذا للفرونت؟

- **لا حاجة لإظهار حقل الكود** في نماذج الإضافة (Create forms) — الباكند يتولى توليده
- **يمكن إظهار الكود** في نماذج التعديل (Update forms) كحقل اختياري لمن يريد تغييره يدوياً
- **اعرض الكود** في صفحات العرض والقوائم — سيكون موجوداً دائماً في الاستجابة
- إذا أرسل المستخدم كوداً يدوياً والكود موجود مسبقاً، سيعيد الباكند خطأ:
  ```json
  { "code": "WORK_SCHEDULE_CODE_EXISTS", "message": "Work schedule code already exists" }
  ```

---

## 2. تعديل نموذج الموظف (Employee Form)

### 2.1 تغيير قيم نوع العقد (ContractType)

**القيم القديمة (لا تستخدمها)**:

```
PERMANENT  →  محذوف
CONTRACT   →  محذوف
INTERNSHIP →  محذوف
```

**القيم الجديدة (استخدم هذه فقط)**:

```typescript
enum ContractType {
  FIXED_TERM  = 'FIXED_TERM',   // عقد محدد المدة
  INDEFINITE  = 'INDEFINITE',   // عقد غير محدد المدة
  TEMPORARY   = 'TEMPORARY',    // عقد مؤقت
  TRAINEE     = 'TRAINEE',      // متدرب
}
```

> **مهم:** قيمة `TEMPORARY` موجودة في القديم والجديد — لا تحتاج تغيير.

### 2.2 حقول المؤهلات والخبرة (جديدة)

أضف هذه الحقول لنموذج إنشاء/تعديل الموظف:

```typescript
// سنوات الخبرة
yearsOfExperience?: number          // رقم صحيح >= 0

// الشهادة الأولى
certificate1?: string               // اسم الشهادة (نص)
specialization1?: string            // التخصص (نص)
certificateAttachment1?: string     // رابط الملف (URL)

// الشهادة الثانية
certificate2?: string
specialization2?: string
certificateAttachment2?: string
```

### 2.3 الشهادات التدريبية (جديدة — مصفوفة)

```typescript
trainingCertificates?: Array<{
  name: string           // اسم الشهادة (مطلوب)
  attachmentUrl?: string // رابط المرفق (اختياري)
}>
```

**مثال طلب إنشاء موظف كامل:**

```json
{
  "firstNameAr": "أحمد",
  "lastNameAr": "العمري",
  "email": "ahmed@company.com",
  "gender": "MALE",
  "departmentId": "uuid-here",
  "hireDate": "2025-01-01",
  "contractType": "INDEFINITE",
  "basicSalary": 5000,
  "yearsOfExperience": 7,
  "certificate1": "بكالوريوس إدارة أعمال",
  "specialization1": "إدارة الموارد البشرية",
  "certificateAttachment1": "https://storage.example.com/cert1.pdf",
  "certificate2": "ماجستير",
  "specialization2": "إدارة المشاريع",
  "trainingCertificates": [
    { "name": "PMP", "attachmentUrl": "https://storage.example.com/pmp.pdf" },
    { "name": "SHRM", "attachmentUrl": null }
  ],
  "allowances": [
    { "type": "MEDICAL", "amount": 500 },
    { "type": "EXPERIENCE", "amount": 750 }
  ]
}
```

### 2.4 البدلات (Allowances — جديدة — مصفوفة)

```typescript
allowances?: Array<{
  type: AllowanceType    // نوع البدل (مطلوب)
  amount: number         // المبلغ >= 0 (مطلوب)
}>

enum AllowanceType {
  MEDICAL        = 'MEDICAL',        // بدل طبي
  EXPERIENCE     = 'EXPERIENCE',     // بدل خبرة
  HIGHER_DEGREE  = 'HIGHER_DEGREE',  // بدل مؤهل عالٍ
  WORK_NATURE    = 'WORK_NATURE',    // بدل طبيعة عمل
  RESPONSIBILITY = 'RESPONSIBILITY', // بدل مسؤولية
}
```

> **ملاحظة عند التعديل (Update):** إذا أرسلت مصفوفة `allowances` أو `trainingCertificates` في طلب التعديل، سيحذف الباكند القديمة ويضع الجديدة مكانها (replace all). إذا لم ترسل المصفوفة أصلاً فلن يتغير شيء.

### 2.5 التحقق من الراتب (Salary Validation)

إذا كان الموظف مرتبطاً بدرجة وظيفية (`jobGradeId`) وأرسلت `basicSalary`، سيتحقق الباكند أن الراتب ضمن الحد الأدنى والأقصى للدرجة.

**الخطأ المتوقع:**

```json
{
  "code": "SALARY_OUT_OF_RANGE",
  "message": "Salary 3000 is below the minimum 4000 for job grade \"المستوى الثاني\"",
  "details": [{ "field": "basicSalary", "min": 4000, "max": 8000 }]
}
```

**اقتراح للفرونت:** عند اختيار الدرجة الوظيفية، اعرض نطاق الراتب المسموح تحت حقل الراتب كـ hint.

---

## 3. بنية الاستجابة المُحدَّثة للموظف (Response Structure)

الاستجابة من `GET /employees/:id` و `GET /employees` تتضمن الآن:

```typescript
{
  id: string
  employeeNumber: string          // VTX-EMP-000001
  firstNameAr: string
  lastNameAr: string
  firstNameEn?: string
  lastNameEn?: string
  email: string
  gender: "MALE" | "FEMALE"
  contractType: "FIXED_TERM" | "INDEFINITE" | "TEMPORARY" | "TRAINEE"
  basicSalary?: number
  yearsOfExperience?: number      // جديد
  certificate1?: string           // جديد
  specialization1?: string        // جديد
  certificateAttachment1?: string // جديد
  certificate2?: string           // جديد
  specialization2?: string        // جديد
  certificateAttachment2?: string // جديد
  department: { id, code, nameAr, nameEn }
  jobTitle: { id, code, nameAr, nameEn }
  manager: { id, employeeNumber, firstNameAr, lastNameAr }
  attachments: Array<{ id, fileUrl, fileName }>
  trainingCertificates: Array<{   // جديد
    id: string
    name: string
    attachmentUrl?: string
    createdAt: string
  }>
  allowances: Array<{             // جديد
    id: string
    type: AllowanceType
    amount: number
    createdAt: string
    updatedAt: string
  }>
  // ... باقي الحقول
}
```

---

## 4. تفاصيل الـ Endpoints الجديدة

لا يوجد endpoints جديدة — جميع التعديلات على الـ endpoints الموجودة.

### الـ Endpoints المتأثرة:

#### الأقسام
- `POST /departments` — حقل `code` أصبح اختيارياً
- `PUT /departments/:id` — لا تغيير في البنية

#### الدرجات الوظيفية
- `POST /job-grades` — حقل `code` أصبح اختيارياً
- `PUT /job-grades/:id` — لا تغيير في البنية

#### المسميات الوظيفية
- `POST /job-titles` — حقل `code` أصبح اختيارياً
- `PUT /job-titles/:id` — لا تغيير في البنية

#### الموظفون
- `POST /employees` — `employeeNumber` اختياري + حقول جديدة (شهادات، بدلات، خبرة)
- `PUT /employees/:id` — نفس الحقول الجديدة + replace للمصفوفات

#### فترات التقييم
- `POST /evaluation-periods` — حقل `code` أصبح اختيارياً

#### الطلبات الإدارية
- `POST /requests` — حقل `requestNumber` **لا يُرسَل** من الفرونت أصلاً (يولّده الباكند داخلياً)

#### جداول الدوام
- `POST /work-schedules` — حقل `code` أصبح اختيارياً

---

## 5. ملخص القرارات التصميمية المطلوبة من الفرونت

| # | القرار | التوصية |
|---|---|---|
| 1 | هل تعرض حقل الكود في نموذج الإضافة؟ | لا — الكود يُولَّد تلقائياً |
| 2 | هل تعرض الكود في نموذج التعديل؟ | نعم — كحقل اختياري قابل للتغيير |
| 3 | كيف تعرض ContractType؟ | قائمة منسدلة بالقيم الأربع الجديدة فقط |
| 4 | كيف تضيف الشهادات التدريبية؟ | Dynamic list — زر "إضافة شهادة" يضيف صفاً جديداً |
| 5 | كيف تضيف البدلات؟ | Dynamic list — زر "إضافة بدل" مع قائمة نوع البدل |
| 6 | عند تعديل الموظف والبدلات؟ | أرسل المصفوفة الكاملة (كل البدلات المطلوبة)، الباكند يستبدل القديمة بالكاملة |
| 7 | عرض نطاق الراتب عند اختيار الدرجة؟ | نعم — اجلب بيانات الدرجة وأظهر `minSalary` و `maxSalary` كـ hint |

---

## 6. أمثلة كاملة على الطلبات

### إنشاء قسم (بدون كود)
```http
POST /departments
Content-Type: application/json

{
  "nameAr": "الموارد البشرية",
  "nameEn": "Human Resources"
}
```

**الاستجابة:**
```json
{
  "id": "...",
  "code": "VTX-DEP-000001",
  "nameAr": "الموارد البشرية",
  "nameEn": "Human Resources"
}
```

---

### إنشاء موظف مع بدلات وشهادات
```http
POST /employees
Content-Type: application/json

{
  "firstNameAr": "محمد",
  "lastNameAr": "السالم",
  "email": "m.salem@company.com",
  "gender": "MALE",
  "departmentId": "dept-uuid",
  "jobGradeId": "grade-uuid",
  "hireDate": "2025-03-01",
  "contractType": "FIXED_TERM",
  "contractEndDate": "2026-03-01",
  "basicSalary": 6000,
  "yearsOfExperience": 5,
  "certificate1": "بكالوريوس هندسة",
  "specialization1": "هندسة البرمجيات",
  "trainingCertificates": [
    { "name": "AWS Solutions Architect" }
  ],
  "allowances": [
    { "type": "EXPERIENCE", "amount": 600 },
    { "type": "RESPONSIBILITY", "amount": 400 }
  ]
}
```

---

### تعديل بدلات موظف (استبدال كامل)
```http
PUT /employees/:id
Content-Type: application/json

{
  "allowances": [
    { "type": "MEDICAL", "amount": 500 },
    { "type": "EXPERIENCE", "amount": 700 },
    { "type": "RESPONSIBILITY", "amount": 300 }
  ]
}
```
> ملاحظة: هذا سيحذف البدلات القديمة ويضع الثلاثة الجديدة.

---

### إنشاء فترة تقييم (بدون كود)
```http
POST /evaluation-periods
Content-Type: application/json

{
  "nameAr": "تقييم الربع الأول 2025",
  "startDate": "2025-01-01",
  "endDate": "2025-03-31"
}
```

**الاستجابة:**
```json
{
  "id": "...",
  "code": "VTX-EVL-000001",
  "nameAr": "تقييم الربع الأول 2025",
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-03-31T00:00:00.000Z"
}
```
