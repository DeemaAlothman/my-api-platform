# 🔐 دليل إعداد Permissions

## المشكلة
عند استدعاء `GET /permissions` من السيرفر، البيانات ترجع فارغة لأن Leave permissions مش موجودة في قاعدة البيانات.

---

## ✅ الحل النهائي: تحديث Users Service Seed

### ما تم عمله:
✅ أضفنا جميع Leave permissions (24 permission) إلى ملف seed الخاص بـ Users Service

---

## 📁 الملفات المحدثة

### 1. `apps/users/prisma/seed.ts`
```typescript
const permissions = [
  // ... existing permissions

  // Leave Types (4)
  { name: 'leave_types:read', displayName: 'عرض أنواع الإجازات', module: 'leaves' },
  { name: 'leave_types:create', displayName: 'إنشاء نوع إجازة', module: 'leaves' },
  { name: 'leave_types:update', displayName: 'تعديل نوع إجازة', module: 'leaves' },
  { name: 'leave_types:delete', displayName: 'حذف نوع إجازة', module: 'leaves' },

  // Leave Requests (9)
  { name: 'leave_requests:read', displayName: 'عرض طلبات الإجازة', module: 'leaves' },
  { name: 'leave_requests:read_all', displayName: 'عرض جميع الطلبات', module: 'leaves' },
  { name: 'leave_requests:create', displayName: 'إنشاء طلب إجازة', module: 'leaves' },
  { name: 'leave_requests:update', displayName: 'تعديل طلب إجازة', module: 'leaves' },
  { name: 'leave_requests:submit', displayName: 'تقديم طلب إجازة', module: 'leaves' },
  { name: 'leave_requests:delete', displayName: 'حذف طلب إجازة', module: 'leaves' },
  { name: 'leave_requests:approve_manager', displayName: 'موافقة المدير', module: 'leaves' },
  { name: 'leave_requests:approve_hr', displayName: 'موافقة HR', module: 'leaves' },
  { name: 'leave_requests:cancel', displayName: 'إلغاء طلب إجازة', module: 'leaves' },

  // Leave Balances (7)
  { name: 'leave_balances:read', displayName: 'عرض رصيد الإجازات', module: 'leaves' },
  { name: 'leave_balances:read_all', displayName: 'عرض جميع الأرصدة', module: 'leaves' },
  { name: 'leave_balances:create', displayName: 'إنشاء رصيد', module: 'leaves' },
  { name: 'leave_balances:adjust', displayName: 'تعديل رصيد', module: 'leaves' },
  { name: 'leave_balances:initialize', displayName: 'تهيئة أرصدة', module: 'leaves' },
  { name: 'leave_balances:delete', displayName: 'حذف رصيد', module: 'leaves' },
  { name: 'leave_balances:carry_over', displayName: 'ترحيل الأرصدة', module: 'leaves' },

  // Holidays (4)
  { name: 'holidays:read', displayName: 'عرض العطل الرسمية', module: 'leaves' },
  { name: 'holidays:create', displayName: 'إنشاء عطلة', module: 'leaves' },
  { name: 'holidays:update', displayName: 'تعديل عطلة', module: 'leaves' },
  { name: 'holidays:delete', displayName: 'حذف عطلة', module: 'leaves' },
];
```

**المجموع**: 24 leave permission + 16 permission موجودة = **40 permission**

---

## 🚀 تطبيق التحديث

### على المشروع المحلي:

#### الطريقة 1: إعادة تشغيل Seed (الأسهل)
```bash
cd apps/users
npm run prisma:seed
```

#### الطريقة 2: باستخدام Docker
```bash
docker compose exec users npm run prisma:seed
```

#### الطريقة 3: ملف SQL المنفصل (بديل)
```bash
docker compose exec postgres psql -U postgres -d platform < add-leave-permissions.sql
```

---

### على السيرفر:

#### الخطوة 1: سحب التحديثات
```bash
cd /path/to/project
git pull origin main
```

#### الخطوة 2: تشغيل Seed
```bash
# إذا كنت تستخدم Docker
docker compose exec users npm run prisma:seed

# أو إذا كنت تستخدم Node مباشرة
cd apps/users
npm run prisma:seed
```

---

## 🔍 التحقق من النجاح

### 1. عدد Permissions الكلي
```bash
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT COUNT(*) FROM users.permissions;"
```
**المتوقع**: 40 (أو أكثر)

### 2. Leave Permissions فقط
```bash
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT COUNT(*) FROM users.permissions WHERE module = 'leaves';"
```
**المتوقع**: 24

### 3. عرض Leave Permissions
```bash
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT name, \"displayName\", module FROM users.permissions WHERE module = 'leaves' ORDER BY name;"
```

### 4. Super Admin Permissions
```bash
docker compose exec postgres psql -U postgres -d platform -c \
  "SELECT COUNT(*) FROM users.role_permissions rp
   JOIN users.roles r ON r.id = rp.\"roleId\"
   WHERE r.name = 'super_admin';"
```
**المتوقع**: 40 (جميع الـ permissions)

---

## 🧪 اختبار من API

### 1. تسجيل الدخول
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

### 2. قائمة Permissions
```bash
curl http://localhost:8000/api/v1/permissions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**يجب أن ترى**:
```json
[
  {
    "id": "...",
    "name": "leave_types:read",
    "displayName": "عرض أنواع الإجازات",
    "module": "leaves"
  },
  {
    "id": "...",
    "name": "leave_requests:create",
    "displayName": "إنشاء طلب إجازة",
    "module": "leaves"
  },
  ...
]
```

### 3. Filter by Module
```bash
curl "http://localhost:8000/api/v1/permissions?module=leaves" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📋 قائمة Leave Permissions الكاملة

| # | Permission | Display Name | الوصف |
|---|-----------|--------------|-------|
| **Leave Types** | | | |
| 1 | `leave_types:read` | عرض أنواع الإجازات | View leave types |
| 2 | `leave_types:create` | إنشاء نوع إجازة | Create leave type |
| 3 | `leave_types:update` | تعديل نوع إجازة | Update leave type |
| 4 | `leave_types:delete` | حذف نوع إجازة | Delete leave type |
| **Leave Requests** | | | |
| 5 | `leave_requests:read` | عرض طلبات الإجازة | View own requests |
| 6 | `leave_requests:read_all` | عرض جميع الطلبات | View all requests |
| 7 | `leave_requests:create` | إنشاء طلب إجازة | Create request |
| 8 | `leave_requests:update` | تعديل طلب إجازة | Update request |
| 9 | `leave_requests:submit` | تقديم طلب إجازة | Submit request |
| 10 | `leave_requests:delete` | حذف طلب إجازة | Delete request |
| 11 | `leave_requests:approve_manager` | موافقة المدير | Manager approval |
| 12 | `leave_requests:approve_hr` | موافقة HR | HR approval |
| 13 | `leave_requests:cancel` | إلغاء طلب إجازة | Cancel request |
| **Leave Balances** | | | |
| 14 | `leave_balances:read` | عرض رصيد الإجازات | View own balance |
| 15 | `leave_balances:read_all` | عرض جميع الأرصدة | View all balances |
| 16 | `leave_balances:create` | إنشاء رصيد | Create balance |
| 17 | `leave_balances:adjust` | تعديل رصيد | Adjust balance |
| 18 | `leave_balances:initialize` | تهيئة أرصدة | Initialize balances |
| 19 | `leave_balances:delete` | حذف رصيد | Delete balance |
| 20 | `leave_balances:carry_over` | ترحيل الأرصدة | Carry over |
| **Holidays** | | | |
| 21 | `holidays:read` | عرض العطل الرسمية | View holidays |
| 22 | `holidays:create` | إنشاء عطلة | Create holiday |
| 23 | `holidays:update` | تعديل عطلة | Update holiday |
| 24 | `holidays:delete` | حذف عطلة | Delete holiday |

---

## 🔄 إضافة Permissions لـ Role معين

إذا أردت إضافة Leave permissions لدور معين (مثل HR Manager):

```sql
-- الحصول على HR Manager Role ID
SELECT id FROM users.roles WHERE name = 'hr_manager';

-- إضافة جميع Leave permissions لـ HR Manager
INSERT INTO users.role_permissions ("roleId", "permissionId")
SELECT
  'HR_ROLE_ID_HERE',
  p.id
FROM users.permissions p
WHERE p.module = 'leaves'
ON CONFLICT DO NOTHING;
```

أو باستخدام API:
```bash
curl -X PATCH http://localhost:8000/api/v1/roles/ROLE_ID/permissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissionIds": [
      "permission_id_1",
      "permission_id_2",
      ...
    ]
  }'
```

---

## ⚠️ ملاحظات مهمة

### 1. Seed هو الحل الأفضل
- ✅ **استخدم seed**: موحد، يعمل على local و production
- ❌ **لا تستخدم SQL scripts منفصلة**: صعب تتبعها ومزامنتها

### 2. Super Admin يحصل على كل شي تلقائياً
الـ seed script يضيف **جميع** الـ permissions للـ super_admin تلقائياً:
```typescript
// Assign all permissions to Super Admin
await prisma.rolePermission.createMany({
  data: allPermissions.map((perm) => ({
    roleId: superAdminRole.id,
    permissionId: perm.id,
  })),
});
```

### 3. إعادة تشغيل Seed آمنة
الـ seed يستخدم `upsert` فلن يكرر البيانات:
```typescript
await prisma.permission.upsert({
  where: { name: perm.name },  // يتحقق من الاسم
  update: perm,                 // يحدث إذا موجود
  create: perm,                 // ينشئ إذا مش موجود
});
```

---

## 🎯 الخلاصة

### قبل التحديث:
- ❌ 16 permission فقط (users, employees, departments, roles)
- ❌ GET /permissions يرجع مصفوفة ناقصة
- ❌ Leave Service permissions غير موجودة في DB

### بعد التحديث:
- ✅ 40 permission (16 قديمة + 24 leave)
- ✅ GET /permissions يرجع جميع الـ permissions
- ✅ Super Admin لديه جميع الصلاحيات تلقائياً
- ✅ يمكن إضافة Leave permissions لأي role

---

**الحالة**: ✅ جاهز للنشر
