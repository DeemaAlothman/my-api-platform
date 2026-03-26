# نظام إدارة العهد - دليل الفرونت إند

## نظرة عامة
نظام لتسجيل وتتبع العهد (الأصول) المسلّمة للموظفين.
مبني داخل `users-service` ومتاح عبر الـ Gateway.

---

## Base URL
```
http://SERVER_IP:8000/api/v1
```

---

## الـ Endpoints

### 1. جلب كل العهد
```
GET /custodies
```
**Query Parameters (اختيارية):**
| Parameter | النوع | الوصف |
|-----------|-------|-------|
| `page` | number | رقم الصفحة (افتراضي: 1) |
| `limit` | number | عدد النتائج (افتراضي: 10) |
| `employeeId` | string | فلتر حسب الموظف |
| `status` | string | فلتر حسب الحالة: `WITH_EMPLOYEE` / `RETURNED` / `DAMAGED` / `LOST` |
| `category` | string | فلتر حسب الفئة (انظر قائمة الفئات أدناه) |
| `search` | string | بحث بالاسم أو الرقم التسلسلي |

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid",
        "name": "لابتوب Dell Latitude",
        "description": "وصف اختياري",
        "serialNumber": "DL-001",
        "category": "ELECTRONICS",
        "employeeId": "uuid",
        "assignedDate": "2026-03-26T00:00:00.000Z",
        "returnedDate": null,
        "status": "WITH_EMPLOYEE",
        "notes": "ملاحظات",
        "createdBy": "uuid",
        "createdAt": "2026-03-26T10:00:00.000Z",
        "updatedAt": "2026-03-26T10:00:00.000Z",
        "deletedAt": null,
        "employee": {
          "id": "uuid",
          "firstNameAr": "أحمد",
          "lastNameAr": "محمد",
          "employeeNumber": "EMP-001",
          "department": { "id": "uuid", "nameAr": "تقنية المعلومات" }
        }
      }
    ],
    "meta": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  }
}
```

---

### 2. إنشاء عهدة جديدة
```
POST /custodies
```
**Body:**
```json
{
  "name": "لابتوب Dell Latitude 5540",
  "description": "لابتوب عمل - رام 16 - SSD 512",
  "serialNumber": "DL5540-001",
  "category": "ELECTRONICS",
  "employeeId": "uuid-of-employee",
  "assignedDate": "2026-03-26",
  "notes": "مع الشاحن والحقيبة"
}
```

**الحقول الإلزامية:** `name`, `employeeId`, `assignedDate`
**الحقول الاختيارية:** `description`, `serialNumber`, `category`, `notes`

**ملاحظة:** `serialNumber` يجب أن يكون فريداً إذا أُرسل.

---

### 3. جلب عهدة بالـ ID
```
GET /custodies/:id
```
**Response:** نفس بنية العهدة مع بيانات الموظف الكاملة (الاسم بالعربي والإنجليزي + القسم).

---

### 4. تعديل عهدة
```
PUT /custodies/:id
```
**Body (كل الحقول اختيارية):**
```json
{
  "name": "اسم جديد",
  "description": "وصف جديد",
  "serialNumber": "رقم جديد",
  "category": "FURNITURE",
  "assignedDate": "2026-03-26",
  "notes": "ملاحظات جديدة"
}
```
**ملاحظة:** لا يمكن تغيير `employeeId` من هنا (نقل العهدة عملية منفصلة).

---

### 5. إرجاع عهدة (تغيير الحالة)
```
PATCH /custodies/:id/return
```
**Body:**
```json
{
  "status": "RETURNED",
  "returnedDate": "2026-03-26",
  "notes": "تم الاستلام بحالة جيدة"
}
```

**قيم `status` المسموحة:**
- `RETURNED` - تم إرجاعها
- `DAMAGED` - تالفة
- `LOST` - مفقودة

**ملاحظة:** لا يمكن استخدام هذا الـ endpoint إلا إذا كانت حالة العهدة `WITH_EMPLOYEE`.
إذا لم يُرسل `returnedDate` سيُستخدم تاريخ اليوم تلقائياً.

---

### 6. حذف عهدة (Soft Delete)
```
DELETE /custodies/:id
```
لا يحذف فعلياً - يضع `deletedAt` فقط.

---

### 7. جلب عهد موظف معين
```
GET /custodies/employee/:employeeId
```
يجلب كل العهد الخاصة بموظف معين (مرتبة بتاريخ التسليم تنازلياً).

---

### 8. ملخص عهد موظف
```
GET /custodies/employee/:employeeId/summary
```
**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "withEmployee": 2,
    "returned": 2,
    "damaged": 1,
    "lost": 0
  }
}
```

---

### 9. التحقق من وجود عهد غير مسلّمة
```
GET /custodies/employee/:employeeId/check
```
**Response:**
```json
{
  "success": true,
  "data": {
    "hasUnreturned": true
  }
}
```
يُستخدم للتحقق قبل السماح بتقديم طلب الاستقالة (يعرض تحذير للموظف).

---

## الصلاحيات المطلوبة

| العملية | الصلاحية |
|---------|---------|
| عرض العهد | `custodies:read` |
| إنشاء عهدة | `custodies:create` |
| تعديل / إرجاع | `custodies:update` |
| حذف | `custodies:delete` |

---

## قيم الـ Enums

### CustodyStatus (حالة العهدة)
| القيمة | المعنى |
|--------|--------|
| `WITH_EMPLOYEE` | مع الموظف (الحالة الافتراضية) |
| `RETURNED` | تم إرجاعها |
| `DAMAGED` | تالفة |
| `LOST` | مفقودة |

### CustodyCategory (فئة العهدة)
| القيمة | المعنى |
|--------|--------|
| `ELECTRONICS` | إلكترونيات (لابتوب، جوال، تابلت) |
| `FURNITURE` | أثاث (مكتب، كرسي) |
| `VEHICLE` | مركبة |
| `TOOLS` | أدوات عمل |
| `KEYS` | مفاتيح |
| `UNIFORM` | زي رسمي |
| `OTHER` | أخرى (الافتراضي) |

---

## ربط العهدة بطلب الاستقالة

### السلوك الحالي في الـ Backend:
1. **عند تقديم طلب الاستقالة** (`POST /requests/:id/submit`):
   - إذا كان نوع الطلب `RESIGNATION` وعند الموظف عهد بحالة `WITH_EMPLOYEE`
   - يرفض بـ: `"لا يمكن تقديم طلب استقالة قبل تسليم جميع العهد"`

2. **عند موافقة HR** (`POST /requests/:id/hr-approve`):
   - نفس التحقق كاحتياط إضافي
   - يرفض بـ: `"لا يمكن الموافقة على الاستقالة - الموظف لديه عهد غير مسلّمة"`

### المقترح في الفرونت إند:
- عند فتح نموذج طلب الاستقالة، استدعِ `GET /custodies/employee/:employeeId/check`
- إذا `hasUnreturned: true` → أظهر تحذير: **"لديك عهد غير مسلّمة، يرجى تسليمها قبل تقديم الاستقالة"**
- يمكن إضافة رابط للانتقال لصفحة العهد مباشرة

---

## أمثلة على الاستخدام

### صفحة الموظف - عرض عهده
```
GET /custodies/employee/{employeeId}
GET /custodies/employee/{employeeId}/summary
```

### صفحة إدارة العهد (HR/Admin)
```
GET /custodies?page=1&limit=10
GET /custodies?status=WITH_EMPLOYEE
GET /custodies?employeeId={id}&status=WITH_EMPLOYEE
GET /custodies?search=dell
```

### تسليم عهدة لموظف
```
POST /custodies
{
  "name": "...",
  "employeeId": "...",
  "assignedDate": "...",
  "category": "ELECTRONICS"
}
```

### الإبلاغ عن فقدان عهدة
```
PATCH /custodies/{id}/return
{
  "status": "LOST",
  "notes": "فُقد الجهاز أثناء رحلة عمل"
}
```
