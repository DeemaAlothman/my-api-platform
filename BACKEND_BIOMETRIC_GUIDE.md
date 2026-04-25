# دليل تعديلات الباك اند - ربط بصامة ZKTeco مع نظام الحضور

> **آخر تحديث:** 2026-03-26
> **النظام:** HR Management Platform (NestJS + Prisma + PostgreSQL)
> **الجهاز:** ZKTeco (PUSH/ADMS Protocol)
> **البورت المقترح للسيرفس الجديد:** 4008

---

## جدول المحتويات

1. [نظرة عامة على البنية](#1-نظرة-عامة-على-البنية)
2. [المرحلة 1: إنشاء ZKTeco Service](#2-المرحلة-1-إنشاء-zkteco-service)
3. [المرحلة 2: تعديلات على Attendance Service](#3-المرحلة-2-تعديلات-على-attendance-service)
4. [المرحلة 3: تطوير التقارير](#4-المرحلة-3-تطوير-التقارير)
5. [المرحلة 4: وحدة احتساب الرواتب](#5-المرحلة-4-وحدة-احتساب-الرواتب)
6. [تعديلات البنية التحتية](#6-تعديلات-البنية-التحتية)
7. [ملاحظات أمنية](#7-ملاحظات-أمنية)

---

## 1. نظرة عامة على البنية

### البنية الحالية
```
Gateway (:8000) → Attendance Service (:4004) → PostgreSQL (schema: attendance)
```

### البنية بعد التعديل
```
ZKTeco Device → ZKTeco Service (:4007) → Attendance Service (:4004) → PostgreSQL
                       ↓
              PostgreSQL (schema: biometric)
```

### المبدأ
- جهاز البصمة يبعت البيانات عبر PUSH protocol لـ ZKTeco Service
- ZKTeco Service يحول البيانات ويستدعي Attendance Service API
- Attendance Service يعالج البصمة كما لو كانت check-in أو check-out عادي
- جهاز واحد فقط - نظام Toggle لتحديد دخول/خروج/خروج مؤقت

---

## 2. المرحلة 1: إنشاء ZKTeco Service

### 2.1 هيكل المجلدات

```
apps/zkteco/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── device/
│   │   ├── device.module.ts
│   │   ├── device.controller.ts
│   │   ├── device.service.ts
│   │   └── dto/
│   │       ├── register-device.dto.ts
│   │       └── update-device.dto.ts
│   ├── iclock/
│   │   ├── iclock.module.ts
│   │   ├── iclock.controller.ts      ← PUSH protocol endpoint
│   │   └── iclock.service.ts
│   ├── employee-mapping/
│   │   ├── employee-mapping.module.ts
│   │   ├── employee-mapping.controller.ts
│   │   ├── employee-mapping.service.ts
│   │   └── dto/
│   │       ├── create-mapping.dto.ts
│   │       └── update-mapping.dto.ts
│   ├── sync/
│   │   ├── sync.module.ts
│   │   └── sync.service.ts           ← Toggle logic + إرسال للـ attendance
│   └── common/
│       ├── guards/
│       ├── filters/
│       └── interceptors/
├── Dockerfile
├── package.json
└── tsconfig.json
```

### 2.2 Prisma Schema (`apps/zkteco/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["biometric"]
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

/// أجهزة البصمة المسجلة
model BiometricDevice {
  id           String   @id @default(uuid())
  serialNumber String   @unique              // SN من الجهاز
  nameAr       String                        // "بصامة المدخل الرئيسي"
  nameEn       String?
  location     String?                       // الموقع الفيزيائي
  ipAddress    String?
  model        String?                       // "ZKTeco U160"
  isActive     Boolean  @default(true)
  lastSyncAt   DateTime?                     // آخر اتصال
  apiKey       String   @unique @default(uuid())  // مفتاح مصادقة الجهاز
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  mappings     EmployeeFingerprint[]
  rawLogs      RawAttendanceLog[]

  @@map("biometric_devices")
  @@schema("biometric")
}

/// ربط بصمة الموظف بالجهاز
/// PIN = رقم الموظف المسجل على جهاز البصمة
model EmployeeFingerprint {
  id           String   @id @default(uuid())
  employeeId   String                        // employee.id من schema: users
  pin          String                        // رقم الموظف على الجهاز
  deviceId     String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  device       BiometricDevice @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@unique([pin, deviceId])                  // كل PIN فريد على كل جهاز
  @@index([employeeId])
  @@map("employee_fingerprints")
  @@schema("biometric")
}

/// السجلات الخام من جهاز البصمة (نسخة احتياطية)
model RawAttendanceLog {
  id           String   @id @default(uuid())
  deviceId     String
  deviceSN     String                        // serial number الجهاز
  pin          String                        // رقم الموظف على الجهاز
  employeeId   String?                       // يُحسب من EmployeeFingerprint
  timestamp    DateTime                      // وقت البصمة الفعلي
  rawType      Int      @default(0)          // القيمة الخام من الجهاز (0,1,2...)

  // التفسير بعد المعالجة
  interpretedAs String?                      // CLOCK_IN | CLOCK_OUT | BREAK_OUT | BREAK_IN
  pairIndex     Int?                         // ترتيب البصمة خلال اليوم (1,2,3...)

  // حالة المزامنة
  synced       Boolean  @default(false)      // هل اتبعت للـ attendance service؟
  syncedAt     DateTime?
  syncError    String?                       // رسالة الخطأ إن فشلت المزامنة

  createdAt    DateTime @default(now())

  device       BiometricDevice @relation(fields: [deviceId], references: [id])

  @@index([deviceSN, pin, timestamp])
  @@index([employeeId, timestamp])
  @@index([synced])
  @@map("raw_attendance_logs")
  @@schema("biometric")
}
```

### 2.3 PUSH Protocol Endpoint (iClock Controller)

> **هام:** هذا الإندبوينت يستقبل بيانات من جهاز ZKTeco مباشرة. الجهاز يبعت HTTP requests بصيغة محددة.

#### كيف يعمل PUSH Protocol؟

جهاز ZKTeco بيتواصل مع السيرفر بـ 3 أنواع requests:

**1. Handshake (أول اتصال):**
```
GET /iclock/cdata?SN=XXXX&options=all&pushver=2.4.1&language=0
```
الجهاز يبعت serial number تبعه. السيرفر لازم يرد بـ:
```
HTTP/1.1 200 OK

GET OPTION FROM: {SN}
Stamp=0
OpStamp=0
PhotoStamp=0
ErrorDelay=30
Delay=10
TransTimes=00:00;14:05
TransInterval=1
TransFlag=TransData AttLog
TimeZone=3
Realtime=1
Encrypt=0
```
- `Stamp=0` يعني بدي كل السجلات من البداية
- `Realtime=1` يعني ابعتلي البصمات لحظياً
- `TransFlag=TransData AttLog` يعني ابعتلي سجلات الحضور
- `TimeZone=3` يعني UTC+3

**2. إرسال سجلات الحضور:**
```
POST /iclock/cdata?SN=XXXX&table=ATTLOG&Stamp=9999
Content-Type: text/plain

1	2026-03-26 08:02:15	0	1		0	0
5	2026-03-26 08:05:00	0	1		0	0
12	2026-03-26 08:15:30	0	1		0	0
```
كل سطر: `PIN \t TIMESTAMP \t STATUS \t VERIFY \t WORKCODE \t RESERVED1 \t RESERVED2`
- PIN = رقم الموظف على الجهاز (Tab-separated)
- STATUS = نوع الحدث (0=check-in, 1=check-out في بعض الأجهزة، لكن **لا تعتمد عليه**)
- VERIFY = طريقة التحقق (1=fingerprint, 2=card, 3=password)

> **ملاحظة مهمة:** كثير من أجهزة ZKTeco ما بتفرق بين دخول وخروج بالـ STATUS field.
> لذلك نعتمد على **Toggle Logic** بناءً على ترتيب البصمات.

**3. Realtime Event (بصمة لحظية):**
```
POST /iclock/cdata?SN=XXXX&table=ATTLOG&Stamp=9999
Content-Type: text/plain

PIN=1	Time=2026-03-26 08:02:15	Status=0	Verify=1
```

#### الإندبوينت المطلوب

**ملف:** `apps/zkteco/src/iclock/iclock.controller.ts`

```
Controller path: /iclock
```

| Method | Path | الوظيفة |
|--------|------|---------|
| `GET`  | `/iclock/cdata` | Handshake - الجهاز يسجل نفسه |
| `POST` | `/iclock/cdata` | استقبال سجلات الحضور |
| `GET`  | `/iclock/getrequest` | الجهاز يسأل عن أوامر (اختياري) |
| `POST` | `/iclock/devicecmd` | رد الجهاز على أوامر (اختياري) |

#### معالجة الـ Handshake (GET /iclock/cdata)

```
1. استخرج SN من query parameters
2. ابحث عن الجهاز بـ serialNumber في BiometricDevice
3. إذا ما لقيت الجهاز → رد 404 أو سجله تلقائي (حسب السياسة)
4. حدّث lastSyncAt
5. رد بإعدادات الجهاز (النص أعلاه)
```

#### معالجة سجلات الحضور (POST /iclock/cdata)

```
1. استخرج SN و table من query parameters
2. تأكد إنه table=ATTLOG
3. parse الـ body (tab-separated أو key=value format)
4. لكل سطر:
   a. أنشئ RawAttendanceLog (الخام)
   b. ابحث عن employeeId من EmployeeFingerprint عبر PIN
   c. إذا ما لقيت mapping → سجل warning بالـ syncError واتركه synced=false
   d. إذا لقيت → أرسل للـ SyncService للمعالجة
5. رد بـ "OK" (الجهاز يتوقع هاد الرد)
```

> **الرد المتوقع:** `HTTP 200` مع body يحتوي `OK`

### 2.4 Toggle Logic (Sync Service)

> **هام جداً:** هذا هو القلب المنطقي للنظام. جهاز واحد، بصمة واحدة، لازم نفهم إذا دخول أو خروج أو استراحة.

**ملف:** `apps/zkteco/src/sync/sync.service.ts`

#### القواعد

```
بصمات يوم واحد لموظف واحد مرتبة زمنياً:

البصمة #1 (الأولى)     → CLOCK_IN (دخول)
البصمة #2              → BREAK_OUT (خروج مؤقت)
البصمة #3              → BREAK_IN (رجوع من استراحة)
البصمة #4              → BREAK_OUT (خروج مؤقت ثاني)
البصمة #5              → BREAK_IN (رجوع)
البصمة الأخيرة         → CLOCK_OUT (خروج نهائي)

القاعدة: Toggle بين OUT و IN
- أول بصمة = دخول دائماً
- بعدها: OUT, IN, OUT, IN, ...
- آخر بصمة إذا كانت فردية = خروج نهائي
```

#### حالات خاصة

```
بصمة وحدة فقط باليوم:
  → CLOCK_IN فقط (ما طلع)
  → بنهاية اليوم يتولد تنبيه MISSING_CLOCK_OUT

بصمتين فقط:
  → #1 = CLOCK_IN
  → #2 = CLOCK_OUT (ما في استراحة)

بصمات متقاربة جداً (أقل من 2 دقيقة بين بصمتين):
  → تجاهل البصمة الثانية (بصمة مكررة غير مقصودة)
```

#### آلية الإرسال للـ Attendance Service

بما أن الـ Attendance Service عنده JWT auth، الـ ZKTeco Service بيحتاج يتواصل معه بطريقة من اثنتين:

**الخيار أ (المقترح): HTTP مباشر بـ Service Token**
```
- ZKTeco Service يملك service-to-service JWT token ثابت
- أو API Key خاص للتواصل بين السيرفسات
- يستدعي POST /attendance-records/device-check-in مباشرة
```

**الخيار ب: كتابة مباشرة بقاعدة البيانات**
```
- ZKTeco Service يكتب مباشرة بـ schema: attendance
- أبسط لكن يكسر فصل المسؤوليات
- مقبول إذا بدك سرعة بالتنفيذ
```

**أنا أنصح بالخيار ب كبداية** لأنه أسهل وأسرع بالتنفيذ. لأن السيرفسات كلها على نفس قاعدة البيانات.

#### عند استقبال بصمة (Realtime):

```
1. خزّن بـ RawAttendanceLog
2. جيب كل بصمات هالموظف لهاليوم من RawAttendanceLog
3. رتبهم بالوقت
4. طبّق Toggle Logic لتحديد نوع كل بصمة
5. حدّث interpretedAs و pairIndex لكل بصمة
6. حدّث AttendanceRecord:
   - إذا أول بصمة → أنشئ record جديد (clockIn)
   - إذا آخر بصمة → حدّث clockOut
   - إذا بصمة وسطية → حدّث AttendanceBreak (الجدول الجديد - مرحلة 2)
7. أعد حساب workedMinutes و breakMinutes
```

### 2.5 إدارة الأجهزة (Device Controller)

**ملف:** `apps/zkteco/src/device/device.controller.ts`

| Method | Path | الوظيفة | Permission |
|--------|------|---------|------------|
| `POST` | `/biometric-devices` | تسجيل جهاز جديد | `biometric.devices.create` |
| `GET` | `/biometric-devices` | عرض كل الأجهزة | `biometric.devices.read` |
| `GET` | `/biometric-devices/:id` | عرض جهاز محدد | `biometric.devices.read` |
| `PATCH` | `/biometric-devices/:id` | تعديل جهاز | `biometric.devices.update` |
| `DELETE` | `/biometric-devices/:id` | حذف جهاز | `biometric.devices.delete` |
| `GET` | `/biometric-devices/:id/status` | حالة الاتصال | `biometric.devices.read` |

### 2.6 ربط الموظفين بالبصمة (Employee Mapping Controller)

**ملف:** `apps/zkteco/src/employee-mapping/employee-mapping.controller.ts`

| Method | Path | الوظيفة | Permission |
|--------|------|---------|------------|
| `POST` | `/employee-fingerprints` | ربط موظف بـ PIN | `biometric.mappings.create` |
| `GET` | `/employee-fingerprints` | عرض كل الربطات | `biometric.mappings.read` |
| `GET` | `/employee-fingerprints/by-employee/:employeeId` | بصمات موظف محدد | `biometric.mappings.read` |
| `PATCH` | `/employee-fingerprints/:id` | تعديل ربط | `biometric.mappings.update` |
| `DELETE` | `/employee-fingerprints/:id` | حذف ربط | `biometric.mappings.delete` |
| `POST` | `/employee-fingerprints/bulk` | ربط مجموعة موظفين دفعة واحدة | `biometric.mappings.create` |

#### DTO لربط موظف

```
CreateMappingDto:
  - employeeId: string (required) → ID الموظف من users schema
  - pin: string (required) → الرقم المسجل على جهاز البصمة
  - deviceId: string (required) → ID الجهاز

Validations:
  - تأكد إن employeeId موجود بـ users.employees
  - تأكد إن PIN مو مستخدم على نفس الجهاز
  - تأكد إن الجهاز موجود ونشط
```

### 2.7 الـ main.ts

```
Port: 4007
Global prefix: none (لأن /iclock لازم يكون بالـ root)
CORS: enabled
```

> **ملاحظة:** إندبوينت `/iclock/*` لازم يكون **بدون JWT auth** لأن الجهاز ما بيملك JWT.
> استخدم API Key بالـ query parameter أو SN verification بدلاً منه.
> باقي الإندبوينتات (devices, mappings) لازم يكونوا محميين بـ JWT.

---

## 3. المرحلة 2: تعديلات على Attendance Service

### 3.1 تعديل Schema (`apps/attendance/prisma/schema.prisma`)

#### إضافة حقول على AttendanceRecord

```prisma
model AttendanceRecord {
  // ... الحقول الموجودة حالياً (لا تحذف شيء) ...

  // ═══ حقول جديدة ═══

  // مصدر التسجيل
  source          String   @default("MANUAL")
  // القيم: "BIOMETRIC" | "WEB" | "MOBILE" | "MANUAL"

  // معلومات الجهاز
  deviceSN        String?  // serial number جهاز البصمة

  // الخروجات المؤقتة
  totalBreakMinutes  Int   @default(0)    // مجموع دقائق الخروجات المؤقتة
  netWorkedMinutes   Int?                 // ساعات العمل الصافية (بعد طرح الاستراحات)

  // نوع ارتباط الراتب (يُنسخ من إعدادات الموظف وقت التسجيل)
  salaryLinked    Boolean  @default(true) // true = الراتب مرتبط بالحضور

  breaks          AttendanceBreak[]

  // ... باقي العلاقات الموجودة ...
}
```

#### جدول جديد: AttendanceBreak

```prisma
/// سجلات الخروج المؤقت أثناء الدوام
model AttendanceBreak {
  id                 String    @id @default(uuid())
  attendanceRecordId String
  breakOut           DateTime                  // وقت الخروج
  breakIn            DateTime?                 // وقت الرجوع (null = لسا ما رجع)
  durationMinutes    Int?                      // المدة بالدقائق (يُحسب عند الرجوع)
  reason             String?                   // سبب الخروج (اختياري)
  isAuthorized       Boolean   @default(false) // هل مسموح (استراحة رسمية)؟

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  record             AttendanceRecord @relation(fields: [attendanceRecordId], references: [id], onDelete: Cascade)

  @@index([attendanceRecordId])
  @@map("attendance_breaks")
  @@schema("attendance")
}
```

#### جدول جديد: AttendanceSalarySetting

> هذا الجدول يخزن إعدادات ربط الحضور بالراتب لكل موظف

```prisma
/// إعدادات ارتباط الحضور بالراتب لكل موظف
model EmployeeAttendanceConfig {
  id              String   @id @default(uuid())
  employeeId      String   @unique
  salaryLinked    Boolean  @default(true)    // هل الراتب مرتبط بالحضور؟
  // true  = يتم احتساب حسميات التأخير والغياب
  // false = إثبات وجود فقط (تقارير بدون حسم)

  allowedBreakMinutes  Int  @default(60)     // دقائق الاستراحة المسموحة يومياً
  // الخروجات المؤقتة ضمن هذا الحد لا تُحسم

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("employee_attendance_configs")
  @@schema("attendance")
}
```

### 3.2 تعديل Check-in Logic

**ملف:** `apps/attendance/src/attendance-records/attendance-records.service.ts`

#### تعديل method: `checkIn()`

**التعديل:** إضافة parameters جديدة ومعالجتها

```
التعديلات على checkIn():

1. إضافة parameter: source (default: "WEB")
2. إضافة parameter: deviceSN (optional)
3. جلب EmployeeAttendanceConfig للموظف لمعرفة salaryLinked
4. تخزين source و deviceSN و salaryLinked بالـ record
```

#### إضافة method جديد: `addBreak()`

```
addBreak(employeeId, dto: { breakOut, breakIn?, reason? }):
  1. جد سجل اليوم (AttendanceRecord) للموظف
  2. إذا ما في سجل → خطأ
  3. أنشئ AttendanceBreak مرتبط بالسجل
  4. إذا breakIn موجود → احسب durationMinutes
  5. أعد حساب totalBreakMinutes للسجل
  6. أعد حساب netWorkedMinutes = workedMinutes - totalBreakMinutes
```

#### إضافة method جديد: `closeBreak()`

```
closeBreak(employeeId, dto: { breakIn }):
  1. جد آخر AttendanceBreak مفتوح (breakIn = null) للموظف
  2. إذا ما في → خطأ
  3. حدّث breakIn و durationMinutes
  4. أعد حساب totalBreakMinutes و netWorkedMinutes على الـ record
```

### 3.3 تعديل Check-out Logic

**ملف:** `apps/attendance/src/attendance-records/attendance-records.service.ts`

#### تعديل method: `checkOut()`

```
التعديلات على checkOut():

1. قبل حفظ الـ checkout، أغلق أي break مفتوح (breakIn = null)
   → اعتبر وقت الـ checkout كوقت الرجوع
2. احسب netWorkedMinutes = workedMinutes - totalBreakMinutes
3. خزّن netWorkedMinutes بالـ record
```

### 3.4 إضافة Endpoints جديدة

**ملف:** `apps/attendance/src/attendance-records/attendance-records.controller.ts`

| Method | Path | الوظيفة | Permission |
|--------|------|---------|------------|
| `POST` | `/attendance-records/device-check-in` | check-in من جهاز البصمة | `attendance.records.device` |
| `POST` | `/attendance-records/device-check-out` | check-out من جهاز البصمة | `attendance.records.device` |
| `POST` | `/attendance-records/device-break` | خروج/رجوع مؤقت من جهاز | `attendance.records.device` |
| `GET` | `/attendance-records/:id/breaks` | عرض خروجات مؤقتة لسجل | `attendance.records.read` |

#### DTOs جديدة

```
DeviceCheckInDto:
  - employeeId: string (required)
  - checkInTime: ISO DateTime (required)
  - deviceSN: string (required)
  - source: "BIOMETRIC" (fixed)

DeviceCheckOutDto:
  - employeeId: string (required)
  - checkOutTime: ISO DateTime (required)
  - deviceSN: string (required)
  - source: "BIOMETRIC" (fixed)

DeviceBreakDto:
  - employeeId: string (required)
  - timestamp: ISO DateTime (required)
  - type: "OUT" | "IN" (required)
  - deviceSN: string (required)
```

> **ملاحظة:** الإندبوينتات `device-*` لازم تكون محمية بـ API Key أو service token، مو JWT عادي.
> لأن ZKTeco Service هو يلي بيستدعيها، مو المستخدم.

### 3.5 إضافة EmployeeAttendanceConfig CRUD

**ملفات جديدة:**
```
apps/attendance/src/employee-config/
├── employee-config.module.ts
├── employee-config.controller.ts
├── employee-config.service.ts
└── dto/
    ├── create-employee-config.dto.ts
    └── update-employee-config.dto.ts
```

| Method | Path | الوظيفة | Permission |
|--------|------|---------|------------|
| `POST` | `/employee-attendance-config` | إنشاء إعدادات لموظف | `attendance.config.create` |
| `GET` | `/employee-attendance-config` | عرض كل الإعدادات | `attendance.config.read` |
| `GET` | `/employee-attendance-config/:employeeId` | إعدادات موظف محدد | `attendance.config.read` |
| `PATCH` | `/employee-attendance-config/:employeeId` | تعديل إعدادات | `attendance.config.update` |

> **القيمة الافتراضية:** إذا الموظف ما عنده config → `salaryLinked=true, allowedBreakMinutes=60`

### 3.6 تعديل الـ Module

**ملف:** `apps/attendance/src/app.module.ts`

```
إضافة:
- EmployeeConfigModule للـ imports
```

---

## 4. المرحلة 3: تطوير التقارير

### 4.1 تقارير جديدة مطلوبة

**ملف:** `apps/attendance/src/reports/reports.service.ts` و `reports.controller.ts`

#### التقارير الموجودة حالياً:
- ✅ تقرير يومي (`GET /attendance-reports/daily`)
- ✅ تقرير شهري (`GET /attendance-reports/monthly`)
- ✅ تقرير ملخص (`GET /attendance-reports/summary`)
- ✅ تقرير استراحات (`GET /attendance-reports/breaks`)

#### تقارير جديدة مطلوبة:

| Endpoint | الوظيفة |
|----------|---------|
| `GET /attendance-reports/lateness` | تقرير التأخيرات |
| `GET /attendance-reports/absences` | تقرير الغياب |
| `GET /attendance-reports/temp-exits` | تقرير الخروجات المؤقتة |
| `GET /attendance-reports/monthly-payroll` | ملخص شهري للرواتب |
| `GET /attendance-reports/employee-card/:employeeId` | بطاقة حضور الموظف |

### 4.2 تقرير التأخيرات (`/attendance-reports/lateness`)

```
Query Parameters:
  - dateFrom, dateTo (required)
  - employeeId (optional)
  - departmentId (optional)
  - minLateMinutes (optional, default: 1) → فلتر الحد الأدنى

Response:
{
  dateFrom, dateTo,
  totalLateInstances: 45,
  totalLateMinutes: 890,
  employees: [
    {
      employee: { id, name, employeeNumber, department },
      lateCount: 8,
      totalLateMinutes: 156,
      avgLateMinutes: 19.5,
      details: [
        { date: "2026-03-01", lateMinutes: 22, clockIn: "08:22", scheduledStart: "08:00" },
        ...
      ]
    }
  ]
}
```

### 4.3 تقرير الغياب (`/attendance-reports/absences`)

```
Query Parameters:
  - dateFrom, dateTo (required)
  - employeeId (optional)
  - departmentId (optional)
  - justified (optional) → true=مبرر، false=غير مبرر، null=الكل

Response:
{
  dateFrom, dateTo,
  totalAbsences: 23,
  justifiedCount: 15,
  unjustifiedCount: 8,
  employees: [
    {
      employee: { id, name, employeeNumber, department },
      totalAbsences: 3,
      justifiedAbsences: 2,
      unjustifiedAbsences: 1,
      details: [
        { date: "2026-03-05", justified: true, justificationType: "SICK", status: "HR_APPROVED" },
        { date: "2026-03-18", justified: false, status: null },
      ]
    }
  ]
}
```

### 4.4 تقرير الخروجات المؤقتة (`/attendance-reports/temp-exits`)

```
Query Parameters:
  - dateFrom, dateTo (required)
  - employeeId (optional)
  - departmentId (optional)

Response:
{
  dateFrom, dateTo,
  totalExits: 67,
  totalExitMinutes: 2340,
  authorizedMinutes: 1800,   // ضمن الحد المسموح
  unauthorizedMinutes: 540,  // فوق الحد المسموح
  employees: [
    {
      employee: { id, name, employeeNumber },
      allowedBreakMinutes: 60,    // من EmployeeAttendanceConfig
      totalExits: 12,
      totalExitMinutes: 450,
      overLimitMinutes: 90,       // الدقائق فوق الحد (12 يوم × 60 = 720 مسموح، 450 فعلي → 0 فوق الحد)
      details: [
        {
          date: "2026-03-01",
          breaks: [
            { out: "10:30", in: "10:50", minutes: 20 },
            { out: "13:00", in: "13:45", minutes: 45 }
          ],
          totalMinutes: 65,
          allowedMinutes: 60,
          overLimitMinutes: 5
        }
      ]
    }
  ]
}
```

### 4.5 ملخص شهري للرواتب (`/attendance-reports/monthly-payroll`)

```
Query Parameters:
  - year, month (required)
  - departmentId (optional)

Response:
{
  year, month,
  employees: [
    {
      employee: { id, name, employeeNumber, department },
      salaryLinked: true,
      workingDays: 22,                // أيام العمل بالشهر
      presentDays: 20,
      absentDays: 1,
      absentDaysUnjustified: 1,       // غياب بدون مبرر
      lateDays: 5,
      totalLateMinutes: 87,
      earlyLeaveDays: 2,
      totalEarlyLeaveMinutes: 45,
      totalBreakOverLimitMinutes: 30, // خروجات فوق الحد المسموح
      totalOvertimeMinutes: 120,
      totalWorkedMinutes: 9600,
      netWorkedMinutes: 9200,         // بعد طرح الاستراحات

      // الحسميات (بالدقائق) - تُحسب فقط إذا salaryLinked=true
      deductions: {
        lateMinutes: 87,
        earlyLeaveMinutes: 45,
        breakOverLimitMinutes: 30,
        absentDays: 1,
        totalDeductionMinutes: 162    // مجموع كل الحسميات
      }
    }
  ]
}
```

### 4.6 بطاقة حضور الموظف (`/attendance-reports/employee-card/:employeeId`)

```
Query Parameters:
  - year, month (required)

Response:
{
  employee: { id, name, employeeNumber, department },
  salaryLinked: true,
  schedule: { code: "ADMIN", workStart: "08:00", workEnd: "16:00" },
  year, month,
  summary: {
    workingDays: 22, presentDays: 20, absentDays: 1, lateDays: 5,
    totalLateMinutes: 87, totalWorkedHours: 153.3,
    totalOvertimeHours: 2, totalBreakMinutes: 450
  },
  days: [
    {
      date: "2026-03-01",
      dayName: "Saturday",     // أو "السبت"
      status: "PRESENT",
      clockIn: "07:58",
      clockOut: "16:05",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workedMinutes: 487,
      overtimeMinutes: 5,
      breaks: [
        { out: "12:00", in: "12:45", minutes: 45 }
      ],
      totalBreakMinutes: 45,
      netWorkedMinutes: 442
    },
    {
      date: "2026-03-02",
      dayName: "Sunday",
      status: "LATE",
      clockIn: "08:25",
      clockOut: "16:00",
      lateMinutes: 25,
      ...
    },
    {
      date: "2026-03-07",
      dayName: "Friday",
      status: "WEEKEND",
      clockIn: null, clockOut: null
    },
    ...
  ]
}
```

### 4.7 تعديل التقارير الحالية

#### التقرير اليومي (`dailyReport`)

```
إضافة على الـ response الحالي:
- لكل record: إضافة breaks[] و totalBreakMinutes و netWorkedMinutes و source
- إضافة summary.totalBreakMinutes
```

#### التقرير الشهري (`monthlyReport`)

```
إضافة على الـ response الحالي لكل موظف:
- totalBreakMinutes: مجموع الخروجات المؤقتة
- breakOverLimitMinutes: الخروجات فوق الحد المسموح
- netWorkedMinutes: ساعات العمل الصافية
- salaryLinked: هل مرتبط بالحضور
```

---

## 5. المرحلة 4: وحدة احتساب الرواتب

> **ملاحظة:** هاي الوحدة يمكن تكون service مستقل أو module ضمن attendance.
> أنصح تكون **module ضمن attendance service** كبداية لأنها تعتمد على بيانات الحضور بالكامل.

### 5.1 هيكل الملفات

```
apps/attendance/src/payroll/
├── payroll.module.ts
├── payroll.controller.ts
├── payroll.service.ts
└── dto/
    ├── generate-payroll.dto.ts
    └── payroll-policy.dto.ts
```

### 5.2 Schema الجديد

```prisma
/// سياسة الحسميات
model DeductionPolicy {
  id                    String   @id @default(uuid())
  nameAr                String
  nameEn                String?
  isDefault             Boolean  @default(false)

  // التسامح
  lateToleranceMinutes  Int      @default(15)    // تأخير مسموح بدون حسم

  // طريقة حسم التأخير
  lateDeductionType     String   @default("MINUTE_BY_MINUTE")
  // MINUTE_BY_MINUTE: حسم كل دقيقة تأخير
  // TIERED: حسب شرائح (lateDeductionTiers)

  // شرائح التأخير (JSON) - تُستخدم إذا lateDeductionType = TIERED
  // مثال: [{"from":15,"to":30,"deductMinutes":30},{"from":30,"to":60,"deductMinutes":60},{"from":60,"to":999,"deductMinutes":240}]
  lateDeductionTiers    String?

  // حسم الخروج المبكر
  earlyLeaveDeductionType String @default("MINUTE_BY_MINUTE")

  // حسم الغياب
  absenceDeductionDays  Float    @default(1.0)  // كم يوم يُحسم عن كل يوم غياب

  // حسم التأخيرات المتكررة
  repeatLateThreshold   Int?     // عدد التأخيرات بالشهر يلي بعدها يتحسم إضافي
  repeatLatePenaltyDays Float?   // كم يوم حسم إضافي

  // الخروج المؤقت
  breakOverLimitDeduction String @default("MINUTE_BY_MINUTE")
  // MINUTE_BY_MINUTE | IGNORE | DOUBLE (حسم ضعف المدة)

  isActive              Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@map("deduction_policies")
  @@schema("attendance")
}

/// كشف راتب شهري لكل موظف
model MonthlyPayroll {
  id                String   @id @default(uuid())
  employeeId        String
  year              Int
  month             Int

  // بيانات محسوبة
  workingDays       Int                      // أيام العمل بالشهر
  presentDays       Int
  absentDays        Int
  absentUnjustified Int                      // غياب بدون مبرر
  lateDays          Int
  totalLateMinutes  Int
  earlyLeaveDays    Int
  totalEarlyLeaveMinutes Int
  breakOverLimitMinutes  Int
  overtimeMinutes   Int
  totalWorkedMinutes     Int
  netWorkedMinutes       Int

  // الحسميات بالدقائق
  lateDeductionMinutes       Int @default(0)
  earlyLeaveDeductionMinutes Int @default(0)
  breakDeductionMinutes      Int @default(0)
  absenceDeductionDays       Float @default(0) // عدد أيام الحسم
  repeatLatePenaltyDays      Float @default(0)
  totalDeductionMinutes      Int @default(0)

  // معلومات إضافية
  salaryLinked      Boolean  @default(true)
  policyId          String?                  // سياسة الحسم المستخدمة
  status            String   @default("DRAFT")
  // DRAFT | CONFIRMED | EXPORTED

  notes             String?
  generatedAt       DateTime @default(now())
  confirmedBy       String?
  confirmedAt       DateTime?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([employeeId, year, month])
  @@index([year, month])
  @@map("monthly_payrolls")
  @@schema("attendance")
}
```

### 5.3 Endpoints

| Method | Path | الوظيفة | Permission |
|--------|------|---------|------------|
| `POST` | `/payroll/generate` | توليد كشوف شهرية | `attendance.payroll.generate` |
| `GET` | `/payroll` | عرض كشوف الرواتب | `attendance.payroll.read` |
| `GET` | `/payroll/:employeeId/:year/:month` | كشف موظف محدد | `attendance.payroll.read` |
| `PATCH` | `/payroll/:id/confirm` | تأكيد الكشف | `attendance.payroll.confirm` |
| `POST` | `/payroll/export/:year/:month` | تصدير للنظام المالي | `attendance.payroll.export` |

### 5.4 آلية توليد كشف الراتب الشهري

```
POST /payroll/generate
Body: { year: 2026, month: 3, departmentId?: string, policyId?: string }

الخطوات:
1. جيب كل الموظفين (أو حسب القسم)
2. لكل موظف:
   a. جيب EmployeeAttendanceConfig (salaryLinked, allowedBreakMinutes)
   b. إذا salaryLinked=false → سجل الحضور بدون حسميات
   c. جيب كل AttendanceRecords للشهر
   d. جيب كل AttendanceBreaks المرتبطة
   e. جيب DeductionPolicy (المحددة أو الافتراضية)
   f. احسب:
      - أيام العمل (من WorkSchedule.workDays)
      - أيام الحضور/الغياب/التأخير/الخروج المبكر
      - مجموع دقائق التأخير
      - مجموع دقائق الخروج المبكر
      - مجموع دقائق الخروج المؤقت فوق الحد
      - الأوفرتايم
   g. طبّق سياسة الحسم:
      - تأخير: حسب lateDeductionType
      - خروج مبكر: حسب earlyLeaveDeductionType
      - غياب: absenceDeductionDays × عدد أيام الغياب
      - خروجات مؤقتة: حسب breakOverLimitDeduction
      - تأخيرات متكررة: إذا lateDays > repeatLateThreshold
   h. أنشئ/حدّث MonthlyPayroll

3. رجّع ملخص: كم كشف اتولّد، كم خطأ
```

### 5.5 سياسة الحسم الافتراضية المقترحة

```
الاسم: "السياسة الافتراضية"
lateToleranceMinutes: 15
lateDeductionType: "MINUTE_BY_MINUTE"
earlyLeaveDeductionType: "MINUTE_BY_MINUTE"
absenceDeductionDays: 1.0
breakOverLimitDeduction: "MINUTE_BY_MINUTE"
repeatLateThreshold: null (معطل)

→ يعني: حسم دقيقة بدقيقة لكل شي، بدون شرائح
→ بسيط وعادل، وقابل للتعديل لاحقاً
```

### 5.6 DeductionPolicy CRUD

| Method | Path | الوظيفة | Permission |
|--------|------|---------|------------|
| `POST` | `/deduction-policies` | إنشاء سياسة | `attendance.policies.create` |
| `GET` | `/deduction-policies` | عرض السياسات | `attendance.policies.read` |
| `GET` | `/deduction-policies/:id` | عرض سياسة | `attendance.policies.read` |
| `PATCH` | `/deduction-policies/:id` | تعديل سياسة | `attendance.policies.update` |
| `DELETE` | `/deduction-policies/:id` | حذف سياسة | `attendance.policies.delete` |

---

## 6. تعديلات البنية التحتية

### 6.1 Docker Compose (`docker-compose.yml`)

إضافة service جديد:

```yaml
zkteco:
  build:
    context: .
    dockerfile: apps/zkteco/Dockerfile
  container_name: myapiplatform-zkteco
  restart: unless-stopped
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/platform?schema=biometric
    JWT_ACCESS_SECRET: your-jwt-secret-change-in-production
    ATTENDANCE_SERVICE_URL: http://attendance:4004
    NODE_ENV: production
  ports:
    - "4007:4007"
  depends_on:
    postgres:
      condition: service_healthy
  networks:
    - app-network
```

### 6.2 Gateway (`apps/gateway/`)

إضافة routing للـ ZKTeco Service:

```
Environment variable:
  ZKTECO_SERVICE_URL: http://zkteco:4007

Routes جديدة:
  /biometric-devices/*  → zkteco:4007
  /employee-fingerprints/*  → zkteco:4007

ملاحظة مهمة:
  /iclock/* يجب أن يصل مباشرة لـ zkteco:4007
  بدون المرور بالـ gateway (لأن الجهاز يتوقع response محدد)
  أو يمر بالـ gateway بدون JWT validation
```

### 6.3 إنشاء Schema جديد بالـ Database

```sql
CREATE SCHEMA IF NOT EXISTS biometric;
```

### 6.4 Prisma Migration

```bash
# ZKTeco Service
cd apps/zkteco
npx prisma migrate dev --name init_biometric_schema

# Attendance Service (بعد تعديل الـ schema)
cd apps/attendance
npx prisma migrate dev --name add_breaks_and_payroll
```

### 6.5 Permissions الجديدة

> يجب إضافة هذه الصلاحيات بجدول permissions في schema: users

```
# ZKTeco Service
biometric.devices.create
biometric.devices.read
biometric.devices.update
biometric.devices.delete
biometric.mappings.create
biometric.mappings.read
biometric.mappings.update
biometric.mappings.delete

# Attendance Service - جديد
attendance.records.device      # للتواصل بين السيرفسات
attendance.config.create
attendance.config.read
attendance.config.update
attendance.payroll.generate
attendance.payroll.read
attendance.payroll.confirm
attendance.payroll.export
attendance.policies.create
attendance.policies.read
attendance.policies.update
attendance.policies.delete
```

---

## 7. ملاحظات أمنية

### 7.1 حماية endpoint الـ iClock

```
- /iclock/* بدون JWT (الجهاز ما بيدعم JWT)
- الحماية عبر:
  1. التحقق من SN: الجهاز لازم يكون مسجل بـ BiometricDevice
  2. IP Whitelist (اختياري): فقط IP الجهاز المسجل
  3. Rate Limiting: حد أقصى للطلبات من نفس الـ IP
```

### 7.2 التواصل بين السيرفسات

```
- ZKTeco Service → Attendance Service:
  استخدم API Key ثابت بالـ environment variables
  أو اكتب مباشرة بقاعدة البيانات (أسهل)
```

### 7.3 بيانات حساسة

```
- بيانات البصمة الفيزيائية (fingerprint template) لا تُخزن بالنظام
  الجهاز يحتفظ بها محلياً ويرسل فقط PIN + timestamp
- لا يوجد أي بيانات بيومترية حساسة بقاعدة البيانات
```

---

## ملخص المراحل والملفات المتأثرة

### المرحلة 1: ZKTeco Service (سيرفس جديد بالكامل)
| العنصر | التفاصيل |
|--------|----------|
| مجلد جديد | `apps/zkteco/` |
| Schema جديد | `biometric` بالـ database |
| جداول جديدة | `BiometricDevice`, `EmployeeFingerprint`, `RawAttendanceLog` |
| Endpoints | `/iclock/*`, `/biometric-devices/*`, `/employee-fingerprints/*` |
| Docker | إضافة service بـ `docker-compose.yml` |
| Gateway | إضافة routing |

### المرحلة 2: تعديلات Attendance Service
| العنصر | التفاصيل |
|--------|----------|
| Schema | إضافة `AttendanceBreak`, `EmployeeAttendanceConfig` + حقول جديدة على `AttendanceRecord` |
| Service | تعديل `checkIn()`, `checkOut()` + methods جديدة `addBreak()`, `closeBreak()` |
| Controller | endpoints جديدة: `device-check-in`, `device-check-out`, `device-break` |
| Module جديد | `EmployeeConfigModule` |

### المرحلة 3: التقارير
| العنصر | التفاصيل |
|--------|----------|
| ملفات موجودة | تعديل `reports.service.ts` و `reports.controller.ts` |
| تقارير جديدة | 5 تقارير: lateness, absences, temp-exits, monthly-payroll, employee-card |
| تعديل موجود | إضافة breaks و netWorkedMinutes للتقارير الحالية |

### المرحلة 4: الرواتب
| العنصر | التفاصيل |
|--------|----------|
| Schema | `DeductionPolicy`, `MonthlyPayroll` |
| Module جديد | `PayrollModule` ضمن attendance service |
| Endpoints | `/payroll/*`, `/deduction-policies/*` |
