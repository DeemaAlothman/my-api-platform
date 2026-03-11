# تحديثات API - 2026-03-02
## ملخص التعديلات المطلوبة في الفرونت

---

## 1. الموظفون (Employees) - حقول جديدة

### ما الذي تغيّر؟
تمت إضافة حقول شخصية جديدة للموظف وجدول مرفقات منفصل.

---

### Response جديد لـ GET /employees و GET /employees/:id

الآن كل موظف يرجع بالحقول الإضافية التالية:

```json
{
  "id": "uuid",
  "employeeNumber": "EMP000001",
  "firstNameAr": "أحمد",
  "lastNameAr": "محمد",

  "profilePhoto": "https://storage.example.com/photo.jpg",
  "bloodType": "A_POSITIVE",
  "familyMembersCount": 4,
  "chronicDiseases": "لا يوجد",
  "currentAddress": "دمشق - المزة",
  "isSmoker": false,
  "educationLevel": "UNIVERSITY",
  "universityYear": null,
  "religion": "الإسلام",

  "attachments": [
    {
      "id": "uuid",
      "employeeId": "uuid",
      "fileUrl": "https://storage.example.com/cv.pdf",
      "fileName": "السيرة الذاتية",
      "createdAt": "2026-03-02T10:00:00.000Z"
    }
  ],

  "department": { ... },
  "jobTitle": { ... },
  "manager": { ... },
  "user": { ... }
}
```

> **ملاحظة:** الموظفون القدامى سيرجعون بـ `null` للحقول الجديدة و `[]` للـ attachments — هذا طبيعي.

---

### القيم المقبولة للـ Enums الجديدة

#### `bloodType` — فصيلة الدم
| القيمة | المعنى |
|--------|--------|
| `A_POSITIVE` | A+ |
| `A_NEGATIVE` | A- |
| `B_POSITIVE` | B+ |
| `B_NEGATIVE` | B- |
| `AB_POSITIVE` | AB+ |
| `AB_NEGATIVE` | AB- |
| `O_POSITIVE` | O+ |
| `O_NEGATIVE` | O- |

#### `educationLevel` — المستوى التعليمي
| القيمة | المعنى |
|--------|--------|
| `ILLITERATE` | أمي |
| `PRIMARY` | ابتدائي |
| `SECONDARY` | ثانوي |
| `DIPLOMA` | دبلوم |
| `UNIVERSITY` | جامعي |
| `POSTGRADUATE` | دراسات عليا |

---

### Body جديد لـ POST /employees (إنشاء موظف)

أضف الحقول الاختيارية الجديدة:

```json
{
  "firstNameAr": "أحمد",
  "lastNameAr": "محمد",
  "email": "ahmed@example.com",
  "gender": "MALE",
  "departmentId": "uuid",
  "hireDate": "2026-01-01",
  "contractType": "PERMANENT",

  "profilePhoto": "https://storage.example.com/photo.jpg",
  "bloodType": "A_POSITIVE",
  "familyMembersCount": 4,
  "chronicDiseases": "لا يوجد",
  "currentAddress": "دمشق - المزة",
  "isSmoker": false,
  "educationLevel": "UNIVERSITY",
  "universityYear": null,
  "religion": "الإسلام",

  "attachments": [
    {
      "fileUrl": "https://storage.example.com/cv.pdf",
      "fileName": "السيرة الذاتية"
    },
    {
      "fileUrl": "https://storage.example.com/id.pdf",
      "fileName": "صورة الهوية"
    }
  ]
}
```

---

### Body جديد لـ PATCH /employees/:id (تحديث موظف)

نفس الحقول الجديدة، كلها اختيارية:

```json
{
  "profilePhoto": "https://storage.example.com/new-photo.jpg",
  "bloodType": "B_POSITIVE",
  "isSmoker": true,
  "educationLevel": "POSTGRADUATE",
  "universityYear": null,
  "familyMembersCount": 5,

  "attachments": [
    {
      "fileUrl": "https://storage.example.com/new-cv.pdf",
      "fileName": "السيرة الذاتية المحدثة"
    }
  ]
}
```

> **تنبيه مهم للمرفقات (attachments):**
> - إذا أرسلت `attachments` في الـ PATCH → تُحذف جميع المرفقات القديمة وتُستبدل بالجديدة.
> - إذا لم ترسل `attachments` في الـ PATCH → تبقى المرفقات القديمة كما هي (لا تتأثر).
> - لحذف جميع المرفقات → أرسل `"attachments": []`

---

## 2. الطلبات الإدارية (Requests) - إضافة بيانات الموظف

### ما الذي تغيّر؟
الآن كل طلب في قائمة الطلبات وتفاصيل الطلب يرجع ببيانات الموظف مباشرة.

---

### Response جديد لـ GET /requests و GET /requests/:id

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
      "notes": null,
      "attachmentUrl": null,
      "details": null,
      "managerStatus": null,
      "managerNotes": null,
      "hrStatus": null,
      "hrNotes": null,
      "createdAt": "2026-03-02T10:00:00.000Z",
      "updatedAt": "2026-03-02T10:05:00.000Z",
      "history": [],

      "employee": {
        "employeeNumber": "EMP000001",
        "firstNameAr": "أحمد",
        "lastNameAr": "محمد",
        "firstNameEn": "Ahmed",
        "lastNameEn": "Mohammed"
      }
    }]
  }
}
```

> **ملاحظة:** `employee` ممكن يكون `null` إذا الموظف محذوف أو غير موجود.

---

## 3. ملخص التغييرات للفرونت

| الصفحة / المكوّن | التعديل المطلوب |
|------------------|----------------|
| صفحة تفاصيل الموظف | عرض الحقول الجديدة (صورة، فصيلة دم، تعليم، إلخ) |
| فورم إنشاء/تعديل موظف | إضافة الحقول الجديدة مع الـ dropdowns للـ enums |
| قسم المرفقات | رفع ملفات متعددة وعرضها وحذفها |
| قائمة الطلبات الإدارية | عرض اسم الموظف من `employee.firstNameAr + employee.lastNameAr` |
| تفاصيل الطلب | عرض رقم الموظف وأسمه من `employee` |

---

## 4. نقاط تقنية مهمة

1. **رفع الملفات:** الـ API يقبل `fileUrl` و `fileName` فقط — الفرونت مسؤول عن رفع الملف إلى storage وإرسال الـ URL.

2. **replace logic للمرفقات:** عند PATCH، إرسال `attachments` يحذف القديم ويضع الجديد. لا ترسل المصفوفة إلا إذا أراد المستخدم تعديل المرفقات.

3. **`universityYear`:** صالح فقط عند `educationLevel = "UNIVERSITY"` (سنة الجامعة 1-7).

4. **`employee` في الطلبات:** قد يكون `null` — تأكد من التحقق قبل العرض:
   ```js
   const name = request.employee
     ? `${request.employee.firstNameAr} ${request.employee.lastNameAr}`
     : 'غير معروف';
   ```
