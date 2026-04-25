# تقرير دراسة جدوى: نظام البريد الداخلي

> **تاريخ التقرير:** 2026-03-26
> **النظام:** HR Management Platform
> **الحالة:** اقتراح أولي

---

## 1. نظرة عامة

نظام بريد داخلي (Internal Messaging) يسمح لموظفي الشركة بالتواصل ضمن المنصة مباشرة بدون الحاجة لأدوات خارجية. يندمج مع البنية الحالية (المستخدمين، الأقسام، الصلاحيات) ويدعم المحادثات الفردية والجماعية والإشعارات.

### لماذا بريد داخلي وليس أداة خارجية؟

| النقطة | بريد داخلي | أداة خارجية (Slack, Teams) |
|--------|-----------|---------------------------|
| التكامل مع النظام | كامل (موظفين، أقسام، صلاحيات) | يحتاج ربط API |
| البيانات | على سيرفرك، تحت سيطرتك | على سيرفرات طرف ثالث |
| التكلفة الشهرية | لا يوجد | اشتراك شهري لكل مستخدم |
| التخصيص | كامل حسب حاجتك | محدود |
| الصيانة | تحتاج مطور | لا تحتاج |

---

## 2. التوافق مع النظام الحالي

### ما الموجود حالياً وبيخدمنا؟

| العنصر | الحالة | الفائدة |
|--------|--------|---------|
| نظام المستخدمين والموظفين | موجود | المرسل والمستقبل جاهزين |
| نظام الأقسام | موجود | إرسال لقسم كامل |
| نظام الصلاحيات (RBAC) | موجود | التحكم بمن يرسل لمن |
| Gateway proxy | موجود | التوجيه جاهز |
| JWT Auth | موجود | المصادقة جاهزة |
| بنية Microservices | موجودة | نضيف service جديد بنفس النمط |
| Docker Compose | موجود | نضيف container جديد |

### ما الناقص؟

| العنصر | ملاحظة |
|--------|--------|
| WebSocket / Real-time | غير موجود - الرسائل ستعمل بـ polling أو SSE |
| نظام إشعارات مركزي | غير موجود - كل service يدير تنبيهاته لحاله |
| نظام مرفقات مركزي | غير موجود - كل service يخزن ملفاته بطريقته |

---

## 3. الخطط المقترحة

---

### الخطة أ: البسيطة (MVP)

> رسائل مباشرة بين الموظفين مع صندوق وارد وصادر

#### المميزات

| الميزة | الوصف |
|--------|-------|
| إرسال رسالة | رسالة من موظف لموظف مع عنوان ونص |
| صندوق وارد | عرض الرسائل الواردة مع pagination |
| صندوق صادر | عرض الرسائل المرسلة |
| قراءة رسالة | عرض محتوى الرسالة + تحديد كمقروءة |
| رد على رسالة | الرد يرتبط بالرسالة الأصلية (thread) |
| عداد غير المقروءة | API يرجع عدد الرسائل غير المقروءة |
| حذف رسالة | حذف ناعم (soft delete) - كل طرف يحذف نسخته |
| بحث بسيط | بحث بالعنوان أو اسم المرسل |

#### الجداول

```
Message:
  - id, senderEmployeeId, subject, body
  - parentMessageId (للرد/thread)
  - createdAt

MessageRecipient:
  - id, messageId, recipientEmployeeId
  - readAt, deletedAt
  - recipientType (TO, CC)

جدولين فقط - بسيط ومباشر
```

#### الـ Endpoints

```
POST   /messages                    → إرسال رسالة
GET    /messages/inbox              → صندوق الوارد
GET    /messages/sent               → صندوق الصادر
GET    /messages/:id                → عرض رسالة
GET    /messages/:id/thread         → عرض سلسلة الردود
PATCH  /messages/:id/read           → تحديد كمقروءة
PATCH  /messages/read-all           → تحديد الكل كمقروء
DELETE /messages/:id                → حذف (soft)
GET    /messages/unread-count       → عدد غير المقروءة
GET    /messages/search             → بحث
```

#### تقدير الوقت

| المهمة | الوقت المقدر |
|--------|-------------|
| إعداد السيرفس (scaffold, prisma, docker) | 1 يوم |
| Schema + Migration | نصف يوم |
| إرسال واستقبال الرسائل (CRUD) | 2 يوم |
| الردود (Thread) | 1 يوم |
| البحث والفلترة | 1 يوم |
| ربط Gateway + Permissions | نصف يوم |
| اختبار وتصحيح | 1 يوم |
| **المجموع** | **~7 أيام عمل** |

---

### الخطة ب: الاحترافية (Full Feature)

> نظام بريد كامل مع محادثات جماعية، مرفقات، إشعارات، تعميمات، وأرشفة

#### المميزات - كل ما في الخطة البسيطة +

| الميزة | الوصف |
|--------|-------|
| **محادثات جماعية** | إرسال رسالة لعدة موظفين أو قسم كامل |
| **CC و BCC** | نسخة ونسخة مخفية |
| **مرفقات** | إرفاق ملفات (PDF, صور, مستندات) مع حد حجم |
| **تعميمات (Announcements)** | رسائل من الإدارة لكل الموظفين أو قسم |
| **أولوية الرسالة** | عادية، مهمة، عاجلة |
| **تصنيفات (Labels)** | تصنيف الرسائل بعلامات مخصصة |
| **أرشفة** | أرشفة الرسائل بدل الحذف |
| **مجلدات** | وارد، صادر، مسودات، أرشيف، سلة المحذوفات |
| **المسودات** | حفظ رسالة كمسودة قبل الإرسال |
| **إعادة توجيه** | إعادة توجيه رسالة لموظف آخر |
| **إشعارات Realtime** | إشعار فوري عند وصول رسالة (SSE) |
| **قوالب رسائل** | قوالب جاهزة للرسائل المتكررة |
| **إحصائيات** | تقارير: عدد الرسائل، أكثر المرسلين، وقت الاستجابة |
| **ربط بالطلبات** | ربط رسالة بطلب إجازة أو طلب إداري |
| **إشعار إيميل** | إرسال تنبيه على الإيميل الخارجي عند وصول رسالة مهمة (اختياري) |

#### الجداول

```
Message:
  - id, senderEmployeeId, subject, body, bodyHtml
  - parentMessageId, conversationId
  - priority (NORMAL, IMPORTANT, URGENT)
  - type (DIRECT, ANNOUNCEMENT, SYSTEM)
  - linkedEntityType, linkedEntityId (ربط بطلب/تقييم/إلخ)
  - isDraft
  - createdAt, updatedAt

MessageRecipient:
  - id, messageId, recipientEmployeeId
  - recipientType (TO, CC, BCC)
  - readAt, archivedAt, deletedAt
  - folderId

MessageAttachment:
  - id, messageId
  - fileName, fileSize, mimeType, filePath
  - createdAt

MessageLabel:
  - id, employeeId, nameAr, nameEn, color
  - createdAt

MessageLabelAssignment:
  - id, messageId, labelId, employeeId

MessageTemplate:
  - id, createdByEmployeeId
  - nameAr, nameEn, subject, body
  - isGlobal (متاح للكل أو خاص)
  - createdAt

Conversation:
  - id, subject
  - participantIds (JSON أو جدول وسيط)
  - lastMessageAt
  - createdAt

ConversationParticipant:
  - id, conversationId, employeeId
  - joinedAt, leftAt, mutedUntil
```

#### الـ Endpoints

```
# الرسائل
POST   /messages                        → إرسال رسالة
POST   /messages/draft                  → حفظ مسودة
GET    /messages/inbox                  → صندوق الوارد
GET    /messages/sent                   → صندوق الصادر
GET    /messages/drafts                 → المسودات
GET    /messages/archived               → الأرشيف
GET    /messages/trash                  → سلة المحذوفات
GET    /messages/:id                    → عرض رسالة
GET    /messages/:id/thread             → سلسلة المحادثة
PATCH  /messages/:id                    → تعديل مسودة
PATCH  /messages/:id/read               → تحديد كمقروءة
PATCH  /messages/read-all               → تحديد الكل كمقروء
PATCH  /messages/:id/archive            → أرشفة
PATCH  /messages/:id/restore            → استعادة من الأرشيف/المحذوفات
DELETE /messages/:id                    → نقل لسلة المحذوفات
DELETE /messages/:id/permanent          → حذف نهائي
POST   /messages/:id/forward            → إعادة توجيه
GET    /messages/unread-count           → عدد غير المقروءة
GET    /messages/search                 → بحث متقدم

# التعميمات
POST   /announcements                   → إنشاء تعميم
GET    /announcements                   → عرض التعميمات
GET    /announcements/:id               → عرض تعميم
PATCH  /announcements/:id               → تعديل تعميم

# المحادثات الجماعية
GET    /conversations                   → عرض المحادثات
GET    /conversations/:id               → عرض محادثة مع الرسائل
POST   /conversations/:id/messages      → إرسال رسالة بمحادثة
PATCH  /conversations/:id/mute          → كتم إشعارات محادثة

# التصنيفات
POST   /message-labels                  → إنشاء تصنيف
GET    /message-labels                  → عرض التصنيفات
PATCH  /message-labels/:id              → تعديل تصنيف
DELETE /message-labels/:id              → حذف تصنيف
POST   /messages/:id/labels/:labelId    → إضافة تصنيف لرسالة
DELETE /messages/:id/labels/:labelId    → إزالة تصنيف

# القوالب
POST   /message-templates               → إنشاء قالب
GET    /message-templates               → عرض القوالب
PATCH  /message-templates/:id           → تعديل قالب
DELETE /message-templates/:id           → حذف قالب

# المرفقات
POST   /messages/:id/attachments        → رفع مرفق
GET    /messages/:id/attachments        → عرض مرفقات
GET    /attachments/:id/download        → تحميل مرفق

# الإشعارات
GET    /notifications/stream            → SSE endpoint للإشعارات الفورية
GET    /notifications                   → عرض الإشعارات
PATCH  /notifications/:id/read          → تحديد إشعار كمقروء

# الإحصائيات
GET    /message-reports/summary         → ملخص (عدد مرسلة/مستقبلة/غير مقروءة)
GET    /message-reports/activity        → نشاط المراسلة حسب الفترة
```

#### تقدير الوقت

| المهمة | الوقت المقدر |
|--------|-------------|
| إعداد السيرفس (scaffold, prisma, docker) | 1 يوم |
| Schema + Migration (10 جداول) | 1 يوم |
| الرسائل CRUD + Thread | 3 أيام |
| المحادثات الجماعية | 2 يوم |
| المرفقات (رفع/تحميل/تخزين) | 2 يوم |
| التعميمات | 1 يوم |
| التصنيفات والمجلدات | 1 يوم |
| المسودات وإعادة التوجيه | 1 يوم |
| القوالب | 1 يوم |
| البحث المتقدم (Full-text search) | 1.5 يوم |
| الإشعارات (SSE + API) | 2 يوم |
| الإحصائيات والتقارير | 1 يوم |
| ربط Gateway + Permissions | 1 يوم |
| ربط بالطلبات والتقييمات | 1 يوم |
| إشعار إيميل خارجي (اختياري) | 1.5 يوم |
| اختبار وتصحيح | 3 أيام |
| **المجموع** | **~24 يوم عمل (~5 أسابيع)** |

---

## 4. مقارنة بين الخطتين

| المعيار | الخطة البسيطة | الخطة الاحترافية |
|---------|-------------|-----------------|
| **الوقت** | ~7 أيام | ~24 يوم |
| **الجداول** | 2 | 10 |
| **الـ Endpoints** | ~12 | ~40+ |
| **المرفقات** | لا | نعم |
| **محادثات جماعية** | لا | نعم |
| **تعميمات** | لا | نعم |
| **إشعارات فورية** | لا | نعم (SSE) |
| **مسودات** | لا | نعم |
| **تصنيفات** | لا | نعم |
| **قوالب** | لا | نعم |
| **بحث متقدم** | بسيط (عنوان) | Full-text search |
| **تقارير** | لا | نعم |
| **ربط بالنظام** | أساسي | كامل (طلبات، تقييمات) |
| **الصعوبة** | متوسطة | عالية |
| **قابلية التوسع** | محدودة | عالية |

---

## 5. البنية التقنية المقترحة

### Service جديد

```
apps/messaging/                    → port 4008
├── prisma/schema.prisma           → schema: messaging
├── src/
│   ├── messages/                  → إرسال/استقبال/بحث
│   ├── conversations/             → المحادثات (الخطة الاحترافية)
│   ├── announcements/             → التعميمات (الخطة الاحترافية)
│   ├── attachments/               → المرفقات (الخطة الاحترافية)
│   ├── labels/                    → التصنيفات (الخطة الاحترافية)
│   ├── templates/                 → القوالب (الخطة الاحترافية)
│   ├── notifications/             → SSE + إشعارات (الخطة الاحترافية)
│   ├── reports/                   → إحصائيات (الخطة الاحترافية)
│   └── common/                    → guards, interceptors, filters
├── Dockerfile
└── package.json
```

### تعديلات على السيرفسات الحالية

| السيرفس | التعديل |
|---------|---------|
| **Gateway** | إضافة routing للـ messaging service |
| **Users Service** | لا تعديل (يُقرأ عبر cross-schema query) |
| **docker-compose.yml** | إضافة messaging container |
| **Permissions** | إضافة صلاحيات messaging بقاعدة البيانات |

### الصلاحيات المطلوبة

```
# الخطة البسيطة
messaging.messages.send
messaging.messages.read
messaging.messages.delete-own

# الخطة الاحترافية (إضافة)
messaging.messages.forward
messaging.announcements.create
messaging.announcements.read
messaging.templates.create
messaging.templates.manage
messaging.labels.manage
messaging.reports.read
messaging.admin                    → إدارة كل الرسائل
```

---

## 6. التوصية

### للبدء السريع
ابدأ بـ **الخطة البسيطة** (7 أيام). تغطي الحاجة الأساسية وتثبت القيمة. بعدها طوّر تدريجياً نحو الخطة الاحترافية حسب الحاجة.

### خارطة طريق مقترحة

```
الأسبوع 1-2:    الخطة البسيطة (رسائل + thread + بحث)
                 ↓ إطلاق واستخدام فعلي
الأسبوع 3:      إضافة مرفقات + تعميمات
الأسبوع 4:      إضافة محادثات جماعية + مسودات
الأسبوع 5:      إضافة إشعارات SSE + تصنيفات
الأسبوع 6:      إضافة قوالب + تقارير + ربط بالطلبات
```

هذا الأسلوب يسمح بـ:
- إطلاق مبكر واستخدام فعلي
- جمع ملاحظات المستخدمين قبل بناء ميزات إضافية
- توزيع الجهد على فترة أطول بدون ضغط
