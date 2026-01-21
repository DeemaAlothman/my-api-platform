# Leave Service

خدمة إدارة الإجازات في منصة API الموحدة.

## المميزات

- إدارة أنواع الإجازات المختلفة
- إدارة أرصدة الإجازات للموظفين
- إنشاء وتقديم طلبات الإجازة
- سير عمل الموافقات (Manager → HR)
- إدارة العطل الرسمية
- تاريخ كامل لجميع العمليات

## البنية

```
src/
├── common/              # Guards, Decorators, Strategies, Filters
├── prisma/              # Prisma Service
├── leave-requests/      # إدارة طلبات الإجازة
├── leave-balances/      # إدارة أرصدة الإجازات
├── leave-types/         # إدارة أنواع الإجازات
├── holidays/            # إدارة العطل الرسمية
└── main.ts             # Entry point
```

## التثبيت

```bash
npm install
```

## إعداد قاعدة البيانات

```bash
# إنشاء الجداول
npx prisma migrate dev

# تعبئة البيانات الأولية
npm run prisma:seed
```

## التشغيل

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## البيانات الأولية

يتضمن seed.ts:
- 10 أنواع إجازات افتراضية (سنوية، مرضية، طارئة، أمومة، إلخ)
- العطل الرسمية لأعوام 2024، 2025، 2026

## API Endpoints

### Leave Requests
- `POST /api/v1/leave-requests` - إنشاء طلب إجازة
- `PUT /api/v1/leave-requests/:id` - تحديث طلب (DRAFT فقط)
- `POST /api/v1/leave-requests/:id/submit` - تقديم الطلب
- `POST /api/v1/leave-requests/:id/approve-manager` - موافقة المدير
- `POST /api/v1/leave-requests/:id/reject-manager` - رفض المدير
- `POST /api/v1/leave-requests/:id/approve-hr` - موافقة HR
- `POST /api/v1/leave-requests/:id/reject-hr` - رفض HR
- `POST /api/v1/leave-requests/:id/cancel` - إلغاء الطلب
- `GET /api/v1/leave-requests/my/requests` - طلباتي
- `GET /api/v1/leave-requests` - جميع الطلبات
- `GET /api/v1/leave-requests/:id` - تفاصيل طلب
- `DELETE /api/v1/leave-requests/:id` - حذف طلب (DRAFT فقط)

### Leave Balances
- `GET /api/v1/leave-balances/my` - رصيدي
- `GET /api/v1/leave-balances/employee/:employeeId` - رصيد موظف
- `GET /api/v1/leave-balances/:id` - تفاصيل رصيد
- `POST /api/v1/leave-balances` - إنشاء رصيد
- `POST /api/v1/leave-balances/:id/adjust` - تعديل رصيد
- `POST /api/v1/leave-balances/employee/:employeeId/carry-over` - ترحيل رصيد
- `POST /api/v1/leave-balances/employee/:employeeId/initialize` - تهيئة أرصدة
- `DELETE /api/v1/leave-balances/:id` - حذف رصيد

### Leave Types
- `GET /api/v1/leave-types` - جميع أنواع الإجازات
- `GET /api/v1/leave-types/:id` - تفاصيل نوع
- `GET /api/v1/leave-types/code/:code` - بحث بالكود
- `POST /api/v1/leave-types` - إنشاء نوع جديد
- `PUT /api/v1/leave-types/:id` - تحديث نوع
- `POST /api/v1/leave-types/:id/toggle-active` - تفعيل/تعطيل
- `DELETE /api/v1/leave-types/:id` - حذف نوع

### Holidays
- `GET /api/v1/holidays` - جميع العطل
- `GET /api/v1/holidays/:id` - تفاصيل عطلة
- `GET /api/v1/holidays/range/:startDate/:endDate` - عطل في نطاق
- `GET /api/v1/holidays/upcoming/list` - العطل القادمة
- `POST /api/v1/holidays` - إنشاء عطلة
- `PUT /api/v1/holidays/:id` - تحديث عطلة
- `POST /api/v1/holidays/clone-year` - استنساخ عطل سنة
- `DELETE /api/v1/holidays/:id` - حذف عطلة

## الصلاحيات المطلوبة

- `leave_requests.create` - إنشاء طلب إجازة
- `leave_requests.update` - تحديث طلب
- `leave_requests.submit` - تقديم طلب
- `leave_requests.read` - عرض الطلبات الخاصة
- `leave_requests.read_all` - عرض جميع الطلبات
- `leave_requests.approve_manager` - موافقة/رفض كمدير
- `leave_requests.approve_hr` - موافقة/رفض كـ HR
- `leave_requests.cancel` - إلغاء طلب
- `leave_requests.delete` - حذف طلب
- `leave_balances.*` - إدارة الأرصدة
- `leave_types.*` - إدارة أنواع الإجازات
- `holidays.*` - إدارة العطل

## Port

Service يعمل على البورت `4003`
