# تقرير التعديلات المطلوبة على نظام إدارة الموارد البشرية

---

## 1. نظام البدلات (Allowances)

### الوضع الحالي
لا يوجد أي نظام بدلات - فقط حقل `basicSalary` واحد وحقل `salaryCurrency`.

### التعديل المطلوب
- إنشاء **جدول جديد** `EmployeeAllowance` بعلاقة One-to-Many مع الموظف
- إنشاء **enum** لأنواع البدلات:

| القيمة | المعنى |
|--------|--------|
| `MEDICAL` | بدل طبي |
| `EXPERIENCE` | بدل خبرات |
| `HIGHER_DEGREE` | بدل شهادة عليا |
| `WORK_NATURE` | بدل طبيعة عمل |
| `RESPONSIBILITY` | بدل مسؤولية |

- كل سجل بدل يحتوي على: **نوع البدل** + **قيمته** (`amount`)
- الموظف يمكن أن يملك **0 أو أكثر** من البدلات
- القيمة تُدخل عند إضافة الموظف

### الملفات المتأثرة
| الملف | التعديل |
|-------|---------|
| `apps/users/prisma/schema.prisma` | إضافة model `EmployeeAllowance` و enum `AllowanceType` |
| `apps/users/src/employees/dto/create-employee.dto.ts` | إضافة مصفوفة بدلات |
| `apps/users/src/employees/dto/update-employee.dto.ts` | إضافة مصفوفة بدلات |
| `apps/users/src/employees/employees.service.ts` | تعديل `create` و `update` و `findOne` و `list` لتشمل البدلات |

---

## 2. تعديل أنواع العقود (ContractType)

### الوضع الحالي
القيم الحالية: `PERMANENT`, `TEMPORARY`, `CONTRACT`, `INTERNSHIP`

### التعديل المطلوب
تغيير القيم لتصبح:

| القيمة الجديدة | المعنى |
|----------------|--------|
| `FIXED_TERM` | محدد المدة |
| `INDEFINITE` | غير محدد المدة |
| `TEMPORARY` | مؤقت (موجود حالياً) |
| `TRAINEE` | متدرب |

- حذف `PERMANENT` و `CONTRACT` و `INTERNSHIP`
- إضافة `FIXED_TERM` و `INDEFINITE` و `TRAINEE`
- **تنبيه:** يجب عمل migration لتحويل البيانات الموجودة في قاعدة البيانات

### الملفات المتأثرة
| الملف | التعديل |
|-------|---------|
| `apps/users/prisma/schema.prisma` | تعديل enum `ContractType` |
| `apps/users/src/employees/dto/create-employee.dto.ts` | تعديل enum `ContractType` في الـ DTO |
| `apps/users/src/employees/dto/update-employee.dto.ts` | نفس التعديل |

---

## 3. المؤهلات العلمية والشهادات

### الوضع الحالي
يوجد فقط حقل `educationLevel` (enum) و `universityYear`، ولا يوجد أي حقول للشهادات أو الخبرات أو المرفقات الأكاديمية.

### التعديل المطلوب

#### أ) حقول مباشرة على جدول الموظف:
| الحقل | النوع | الوصف |
|-------|-------|-------|
| `yearsOfExperience` | Int | عدد سنوات الخبرة |
| `certificate1` | String | اسم الشهادة الأولى |
| `specialization1` | String | تخصص الشهادة الأولى |
| `certificateAttachment1` | String | مرفق الشهادة الأولى (رابط ملف) |
| `certificate2` | String | اسم الشهادة الثانية |
| `specialization2` | String | تخصص الشهادة الثانية |
| `certificateAttachment2` | String | مرفق الشهادة الثانية (رابط ملف) |

#### ب) جدول جديد للشهادات التدريبية:
- إنشاء model `TrainingCertificate` بعلاقة One-to-Many مع الموظف
- يحتوي على: `name` (اسم الشهادة) + `attachmentUrl` (مرفق)
- الموظف يمكن أن يملك **0 أو أكثر** من الشهادات التدريبية

### الملفات المتأثرة
| الملف | التعديل |
|-------|---------|
| `apps/users/prisma/schema.prisma` | إضافة الحقول الجديدة على Employee و model `TrainingCertificate` |
| `apps/users/src/employees/dto/create-employee.dto.ts` | إضافة الحقول الجديدة و DTO للشهادات التدريبية |
| `apps/users/src/employees/dto/update-employee.dto.ts` | نفس التعديل |
| `apps/users/src/employees/employees.service.ts` | تعديل CRUD ليشمل الشهادات التدريبية |

---

## 4. التحقق من الراتب ضمن حدود الدرجة الوظيفية

### الوضع الحالي
الـ `JobGrade` يملك حقلي `minSalary` و `maxSalary` لكن **لا يوجد أي تحقق** عند إضافة أو تعديل الموظف أن راتبه ضمن هذا النطاق.

### التعديل المطلوب
- عند إنشاء أو تعديل موظف، إذا تم تحديد `jobGradeId` و `basicSalary`، يجب جلب الدرجة الوظيفية والتحقق أن الراتب يقع بين `minSalary` و `maxSalary`
- رمي خطأ `BadRequestException` إذا كان الراتب خارج النطاق مع رسالة توضيحية

### الملفات المتأثرة
| الملف | التعديل |
|-------|---------|
| `apps/users/src/employees/employees.service.ts` | إضافة منطق التحقق في دالتي `create` و `update` |

---

## 5. حقل الكود التلقائي (Auto-generated Code) مع اسم الشركة VITAXIR

### الوضع الحالي
| الكيان | حقل الكود | طريقة التوليد |
|--------|-----------|---------------|
| Employee | `employeeNumber` | تلقائي بصيغة `EMP000001` |
| Department | `code` | يدوي |
| JobGrade | `code` | يدوي |
| JobTitle | `code` | يدوي |
| Leave/Attendance/Evaluation | `code` | يدوي أو تلقائي حسب الخدمة |

### التعديل المطلوب
جعل حقل `code` يتولد تلقائياً بصيغة تتضمن اسم الشركة:

| الكيان | الصيغة المقترحة | مثال |
|--------|-----------------|------|
| Employee | `VTX-EMP-000001` | VTX-EMP-000001 |
| Department | `VTX-DEP-000001` | VTX-DEP-000001 |
| JobGrade | `VTX-GRD-000001` | VTX-GRD-000001 |
| JobTitle | `VTX-JTL-000001` | VTX-JTL-000001 |
| Leave Request | `VTX-LRQ-000001` | VTX-LRQ-000001 |
| Attendance | `VTX-ATT-000001` | VTX-ATT-000001 |
| Evaluation | `VTX-EVL-000001` | VTX-EVL-000001 |

### الملفات المتأثرة (عبر كل المشروع)

#### خدمة Users:
| الملف | التعديل |
|-------|---------|
| `apps/users/prisma/schema.prisma` | التأكد من وجود حقل code |
| `apps/users/src/employees/employees.service.ts` | تعديل التوليد التلقائي |
| `apps/users/src/departments/departments.service.ts` | إضافة التوليد التلقائي |
| `apps/users/src/job-grades/job-grades.service.ts` | إضافة التوليد التلقائي |
| `apps/users/src/job-titles/job-titles.service.ts` | إضافة التوليد التلقائي |

#### خدمة Leave:
| الملف | التعديل |
|-------|---------|
| `apps/leave/prisma/schema.prisma` | التحقق من حقل code |
| سيرفس الإجازات | تعديل التوليد |

#### خدمة Attendance:
| الملف | التعديل |
|-------|---------|
| `apps/attendance/prisma/schema.prisma` | التحقق من حقل code |
| سيرفس الحضور | تعديل التوليد |

#### خدمة Evaluation:
| الملف | التعديل |
|-------|---------|
| `apps/evaluation/prisma/schema.prisma` | التحقق من حقل code |
| سيرفس التقييم | تعديل التوليد |

---

## ملخص حجم العمل

| التعديل | الصعوبة | عدد الملفات تقريباً |
|---------|---------|---------------------|
| نظام البدلات | متوسط | 4-5 ملفات |
| تعديل أنواع العقود | بسيط | 2-3 ملفات + migration |
| المؤهلات والشهادات | متوسط | 4-5 ملفات |
| التحقق من الراتب | بسيط | 1-2 ملف |
| الكود التلقائي | متوسط-كبير | 8-12 ملف عبر كل الخدمات |

---

## ملاحظات مهمة

1. كل تعديل على الـ schema يتطلب عمل Prisma migration (`npx prisma migrate dev`)
2. تعديل enum العقود يتطلب كتابة migration يدوي لتحويل البيانات القديمة إذا كانت موجودة
3. يُنصح بتنفيذ التعديلات بالترتيب التالي:
   - تعديل أنواع العقود (الأبسط)
   - التحقق من الراتب (الأبسط)
   - المؤهلات والشهادات
   - نظام البدلات
   - الكود التلقائي (الأشمل لأنه يمس كل الخدمات)
