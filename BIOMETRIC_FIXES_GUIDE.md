# دليل إصلاحات نظام البصمة (ZKTeco Service)

> **المرجع:** خدمة `apps/zkteco` — schema: `biometric` — port: `4007`
> **الهدف:** معالجة الثغرات الأمنية وأخطاء المنطق ونواقص السيناريوهات المكتشفة.
> **تاريخ الإعداد:** 2026-04-18

---

## فهرس الإصلاحات

1. [إصلاحات أمنية حرجة](#1-إصلاحات-أمنية-حرجة)
2. [إصلاحات منطقية حرجة](#2-إصلاحات-منطقية-حرجة)
3. [إصلاحات السيناريوهات الناقصة](#3-إصلاحات-السيناريوهات-الناقصة)
4. [إصلاحات ثانوية](#4-إصلاحات-ثانوية)
5. [خطة التنفيذ المقترحة (مراحل)](#5-خطة-التنفيذ-المقترحة)

---

## 1. إصلاحات أمنية حرجة

### 1.1 🔴 مسار `/iclock` مفتوح بدون أي مصادقة

**الموقع:**
- [apps/zkteco/src/iclock/iclock.controller.ts](apps/zkteco/src/iclock/iclock.controller.ts) — لا يوجد `@UseGuards`
- [apps/gateway/src/main.ts:51-53](apps/gateway/src/main.ts#L51-L53) — `/iclock/*` مستثنى من prefix `api/v1`
- [apps/zkteco/prisma/schema.prisma:23](apps/zkteco/prisma/schema.prisma#L23) — حقل `apiKey` معرَّف لكن غير مستخدم

**المشكلة:**
أي جهة خارجية تعرف الـ `SN` تستطيع إرسال بصمات مزيفة عبر `POST /iclock/cdata?SN=...&table=ATTLOG`.

**الإصلاح المقترح:**

إنشاء guard جديد يفحص `apiKey` من header أو query:

```ts
// apps/zkteco/src/common/guards/device-api-key.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DeviceApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const sn = req.query.SN as string;
    const apiKey = (req.headers['x-device-key'] as string) || (req.query.apiKey as string);

    if (!sn || !apiKey) {
      throw new UnauthorizedException({ code: 'DEVICE_AUTH_MISSING' });
    }

    const device = await this.prisma.biometricDevice.findUnique({
      where: { serialNumber: sn },
    });

    if (!device || !device.isActive || device.apiKey !== apiKey) {
      throw new UnauthorizedException({ code: 'DEVICE_AUTH_INVALID' });
    }

    req.device = device;
    return true;
  }
}
```

ثم تطبيقه على `IclockController`:

```ts
@Controller('iclock')
@UseGuards(DeviceApiKeyGuard)
export class IclockController { ... }
```

**ملاحظة:** بعض أجهزة ZKTeco تدعم فقط query param، وأخرى تدعم headers. ندعم الاثنين.

---

### 1.2 🔴 قبول Handshake من SN مجهول

**الموقع:** [apps/zkteco/src/iclock/iclock.service.ts:28-32](apps/zkteco/src/iclock/iclock.service.ts#L28-L32)

**المشكلة:** يُرجع handshake response كامل لأي SN حتى لو غير مُسجَّل.

**الإصلاح:**

```ts
async handleHandshake(sn: string): Promise<string> {
  const device = await this.deviceService.findBySerialNumber(sn);
  if (!device || !device.isActive) {
    this.logger.warn(`Rejected handshake from unknown/inactive SN: ${sn}`);
    throw new UnauthorizedException({ code: 'DEVICE_NOT_REGISTERED' });
  }
  await this.deviceService.updateLastSync(device.id);
  return this.buildHandshakeResponse(sn);
}
```

---

## 2. إصلاحات منطقية حرجة

### 2.1 🔴 حساب "اليوم" بتوقيت UTC بدل التوقيت المحلي

**الموقع:**
- [apps/zkteco/src/sync/sync.service.ts:28-31](apps/zkteco/src/sync/sync.service.ts#L28-L31)
- [apps/zkteco/src/sync/sync.service.ts:135](apps/zkteco/src/sync/sync.service.ts#L135)

**المشكلة:**
- `setHours(0,0,0,0)` يعتمد على TZ للسيرفر
- `timestamp.toISOString().split('T')[0]` يستخدم UTC
- بصمة الساعة 2:00 صباحاً بتوقيت الرياض = 23:00 UTC من اليوم السابق → السجل يُكتب بتاريخ خاطئ

**الإصلاح المقترح:**

استخدام مكتبة `date-fns-tz` أو حساب يدوي ثابت بـ offset `+03:00`:

```ts
// apps/zkteco/src/common/utils/timezone.ts
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // Asia/Riyadh = UTC+3

export function toLocalDateString(date: Date): string {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  return local.toISOString().split('T')[0]; // YYYY-MM-DD بتوقيت محلي
}

export function localDayRange(date: Date): { start: Date; end: Date } {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  const start = new Date(local.getTime() - TZ_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}
```

ثم في `sync.service.ts`:

```ts
const { start: startOfDay, end: endOfDay } = localDayRange(timestamp);
// ...
const dateStr = toLocalDateString(timestamp);
```

**ملاحظة:** يجب توحيد TZ عبر متغير بيئة `APP_TIMEZONE_OFFSET` أو `TZ=Asia/Riyadh`.

---

### 2.2 🔴 BREAK_OUT / BREAK_IN غير مكتوبة في `attendance_breaks`

**الموقع:** [apps/zkteco/src/sync/sync.service.ts:130-207](apps/zkteco/src/sync/sync.service.ts#L130-L207)

**المشكلة:**
- التفسير يُخزَّن في `RawAttendanceLog.interpretedAs` فقط
- جدول `attendance.attendance_breaks` (إن وُجد) لا يُحدَّث
- `workedMinutes` محسوبة كاملة بدون خصم الاستراحات

**الإصلاح المقترح:**

```ts
private async writeToAttendance(employeeId, timestamp, interpreted, rawLogs) {
  const dateStr = toLocalDateString(timestamp);
  // ... جلب/إنشاء السجل كما هو الحالي ...

  // حذف breaks القديمة لهذا اليوم ثم إعادة الكتابة
  await this.prisma.$executeRaw`
    DELETE FROM attendance.attendance_breaks
    WHERE "attendanceRecordId" = ${recordId}
  `;

  // كتابة الـ breaks الجديدة بالأزواج
  const pairs = this.buildBreakPairs(interpreted); // BREAK_OUT → BREAK_IN
  for (const pair of pairs) {
    await this.prisma.$executeRaw`
      INSERT INTO attendance.attendance_breaks
        (id, "attendanceRecordId", "breakOutTime", "breakInTime", "durationMinutes", "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid(), ${recordId}, ${pair.out}, ${pair.in ?? null},
         ${pair.in ? Math.floor((pair.in.getTime() - pair.out.getTime()) / 60000) : null},
         NOW(), NOW())
    `;
  }

  // حساب workedMinutes بعد خصم الاستراحات
  const totalBreakMinutes = pairs.reduce((sum, p) =>
    p.in ? sum + Math.floor((p.in.getTime() - p.out.getTime()) / 60000) : sum, 0);

  if (clockInTime && clockOutTime) {
    const gross = Math.floor((clockOutTime.getTime() - clockInTime.getTime()) / 60000);
    const net = gross - totalBreakMinutes;
    await this.prisma.$executeRaw`
      UPDATE attendance.attendance_records
      SET "workedMinutes" = ${net}, "breakMinutes" = ${totalBreakMinutes}, "updatedAt" = NOW()
      WHERE id = ${recordId}
    `;
  }
}

private buildBreakPairs(interpreted) {
  const pairs = [];
  let current: { out: Date; in?: Date } | null = null;
  for (const item of interpreted) {
    if (item.interpretedAs === 'BREAK_OUT') {
      if (current) pairs.push(current); // break غير مُغلق
      current = { out: item.timestamp };
    } else if (item.interpretedAs === 'BREAK_IN' && current) {
      current.in = item.timestamp;
      pairs.push(current);
      current = null;
    }
  }
  if (current) pairs.push(current); // break أخير مفتوح
  return pairs;
}
```

**ملاحظة:** يجب التأكد أن جدول `attendance_breaks` موجود في schema attendance. إذا لم يوجد، يجب إضافته في migration.

---

### 2.3 🟠 Race Condition في استقبال بصمات متزامنة

**الموقع:** [apps/zkteco/src/iclock/iclock.service.ts:154-187](apps/zkteco/src/iclock/iclock.service.ts#L154-L187) + [apps/zkteco/src/sync/sync.service.ts:25-76](apps/zkteco/src/sync/sync.service.ts#L25-L76)

**المشكلة:**
- `processNewStamp` يُستدعى متوازياً بدون قفل
- بصمتان لنفس الموظف قد تكتبان قيم متضاربة

**الإصلاح المقترح:**

استخدام **advisory lock** على PostgreSQL بمفتاح `employeeId + date`:

```ts
async processNewStamp(logId, employeeId, deviceSN, timestamp) {
  const dateStr = toLocalDateString(timestamp);
  const lockKey = this.hashLockKey(employeeId + dateStr);

  await this.prisma.$transaction(async (tx) => {
    // قفل على مستوى الجلسة — يُحرَّر تلقائياً عند انتهاء الـ transaction
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    // ... كل منطق المعالجة هنا ...
  });
}

private hashLockKey(s: string): bigint {
  // FNV-1a hash → bigint
  let hash = BigInt(2166136261);
  for (const ch of s) {
    hash ^= BigInt(ch.charCodeAt(0));
    hash = (hash * BigInt(16777619)) & BigInt('0x7FFFFFFFFFFFFFFF');
  }
  return hash;
}
```

---

### 2.4 🟠 عدم التحقق من حالة الموظف

**الموقع:** [apps/zkteco/src/iclock/iclock.service.ts:156-158](apps/zkteco/src/iclock/iclock.service.ts#L156-L158)

**المشكلة:** بصمات لموظفين محذوفين (`deletedAt IS NOT NULL`) تُسجَّل عادياً.

**الإصلاح:**

```ts
const mapping = await this.prisma.employeeFingerprint.findFirst({
  where: { pin: log.pin, deviceId, isActive: true },
});

let employeeId = mapping?.employeeId ?? null;

if (employeeId) {
  const employees = await this.prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM users.employees
    WHERE id = ${employeeId} AND "deletedAt" IS NULL
    LIMIT 1
  `;
  if (employees.length === 0 || employees[0].status !== 'ACTIVE') {
    // لا نُسقط البصمة تماماً — نحفظها مع خطأ واضح
    await this.prisma.rawAttendanceLog.create({
      data: { deviceId, deviceSN, pin: log.pin, employeeId, timestamp: log.timestamp,
              rawType: log.rawType, synced: false,
              syncError: `Employee ${employeeId} inactive/deleted` },
    });
    return;
  }
}
```

---

## 3. إصلاحات السيناريوهات الناقصة

### 3.1 🟠 `lateMinutes` و `earlyLeaveMinutes` دائماً صفر

**الموقع:** [apps/zkteco/src/sync/sync.service.ts:173](apps/zkteco/src/sync/sync.service.ts#L173)

**المشكلة:** القيم ثابتة بدون ربط مع جدول schedules أو policies.

**الإصلاح المقترح:**

جلب جدول عمل الموظف وحساب الفروقات:

```ts
const schedule = await this.prisma.$queryRaw<Array<{
  startTime: string; endTime: string; graceInMinutes: number;
}>>`
  SELECT s."startTime", s."endTime", p."graceInMinutes"
  FROM attendance.employee_schedules es
  JOIN attendance.schedules s ON s.id = es."scheduleId"
  LEFT JOIN attendance.attendance_policies p ON p.id = s."policyId"
  WHERE es."employeeId" = ${employeeId}
    AND ${dateStr}::date BETWEEN es."effectiveFrom" AND COALESCE(es."effectiveTo", '9999-12-31')
  LIMIT 1
`;

let lateMinutes = 0, earlyLeaveMinutes = 0;
if (schedule[0] && clockInTime) {
  const [h, m] = schedule[0].startTime.split(':').map(Number);
  const scheduled = new Date(clockInTime);
  scheduled.setHours(h, m, 0, 0);
  const diff = Math.floor((clockInTime.getTime() - scheduled.getTime()) / 60000);
  lateMinutes = Math.max(0, diff - (schedule[0].graceInMinutes || 0));
}
// نفس الحساب لـ earlyLeaveMinutes من endTime
```

**ملاحظة:** يجب التأكد من schema جدول `employee_schedules` و `attendance_policies` قبل تطبيق الاستعلام.

---

### 3.2 🟠 لا تنبيه MISSING_CLOCK_OUT

**الموقع:** لا يوجد — نحتاج cron job.

**الإصلاح المقترح:**

إضافة `@Cron` في `SyncService` يشتغل يومياً الساعة 23:55:

```ts
// apps/zkteco/src/sync/missing-stamps.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MissingStampsCron {
  private readonly logger = new Logger(MissingStampsCron.name);
  constructor(private prisma: PrismaService) {}

  @Cron('55 23 * * *', { timeZone: 'Asia/Riyadh' })
  async detectMissingClockOut() {
    const today = toLocalDateString(new Date());
    const records = await this.prisma.$queryRaw<Array<{ id: string; employeeId: string }>>`
      SELECT id, "employeeId" FROM attendance.attendance_records
      WHERE date = ${today}::date AND "clockInTime" IS NOT NULL AND "clockOutTime" IS NULL
    `;
    for (const r of records) {
      await this.prisma.$executeRaw`
        INSERT INTO attendance.attendance_alerts
          (id, "employeeId", "attendanceRecordId", type, severity, message, "createdAt")
        VALUES (gen_random_uuid(), ${r.employeeId}, ${r.id},
                'MISSING_CLOCK_OUT', 'WARNING', 'لا توجد بصمة خروج لهذا اليوم', NOW())
        ON CONFLICT DO NOTHING
      `;
    }
    this.logger.log(`Generated missing-clock-out alerts for ${records.length} records`);
  }
}
```

**إضافة في `AppModule`:**

```ts
import { ScheduleModule } from '@nestjs/schedule';
imports: [ScheduleModule.forRoot(), ...]
```

---

### 3.3 🟡 دعم الوردية الليلية (Night Shift)

**الموقع:** [apps/zkteco/src/sync/sync.service.ts:28-31](apps/zkteco/src/sync/sync.service.ts#L28-L31)

**المشكلة:** بصمة دخول 22:00 وخروج 06:00 في اليوم التالي تُعتبر يومين منفصلين.

**الإصلاح المقترح:**

- قراءة نوع الوردية من `employee_schedules` (حقل مثل `shiftType: 'DAY' | 'NIGHT'`).
- إذا `NIGHT`: تمديد نافذة اليوم من 12:00 ظهراً إلى 12:00 ظهر اليوم التالي:

```ts
function shiftDayRange(timestamp: Date, shiftType: 'DAY' | 'NIGHT') {
  if (shiftType === 'DAY') return localDayRange(timestamp);
  // NIGHT: 12:00 → 12:00 التالي
  const local = new Date(timestamp.getTime() + TZ_OFFSET_MS);
  const hour = local.getUTCHours();
  const start = new Date(local);
  if (hour < 12) start.setUTCDate(local.getUTCDate() - 1);
  start.setUTCHours(12, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return {
    start: new Date(start.getTime() - TZ_OFFSET_MS),
    end: new Date(end.getTime() - TZ_OFFSET_MS),
  };
}
```

**ملاحظة:** يتطلب إضافة حقل `shiftType` في جدول الجداول الزمنية.

---

### 3.4 🟡 تعليم البصمات المكررة بدل تركها بدون `interpretedAs`

**الموقع:** [apps/zkteco/src/sync/sync.service.ts:81-96](apps/zkteco/src/sync/sync.service.ts#L81-L96)

**الإصلاح:**

```ts
private filterDuplicates(logs: any[]): { kept: any[]; duplicates: string[] } {
  const kept: any[] = [];
  const duplicates: string[] = [];
  for (const log of logs) {
    if (kept.length === 0) { kept.push(log); continue; }
    const diff = log.timestamp.getTime() - kept[kept.length - 1].timestamp.getTime();
    if (diff >= 2 * 60 * 1000) kept.push(log);
    else duplicates.push(log.id);
  }
  return { kept, duplicates };
}

// في processNewStamp:
const { kept, duplicates } = this.filterDuplicates(todayLogs);
if (duplicates.length > 0) {
  await this.prisma.rawAttendanceLog.updateMany({
    where: { id: { in: duplicates } },
    data: { interpretedAs: 'DUPLICATE_IGNORED' },
  });
}
```

---

## 4. إصلاحات ثانوية

### 4.1 🟡 `rawType` من الجهاز مُهمَل تماماً

**التوصية:** استخدامه كـ **tie-breaker** عند عدد فردي من البصمات أو في حالات الالتباس:
- `rawType=0` → CHECK_IN (دخول)
- `rawType=1` → CHECK_OUT (خروج)

إذا كان آخر بصمتين لهما نفس `rawType`، يكون هناك خطأ محتمل → تُسجَّل في `syncError`.

### 4.2 🟡 Audit Interceptor يضخم الـ logs لطلبات `/iclock`

**الموقع:** [apps/zkteco/src/common/interceptors/audit.interceptor.ts:13](apps/zkteco/src/common/interceptors/audit.interceptor.ts#L13)

**الإصلاح:** تجاهل مسار iclock:

```ts
intercept(ctx, next) {
  const req = ctx.switchToHttp().getRequest();
  if (req.method === 'GET' || req.path.startsWith('/iclock')) return next.handle();
  // ...
}
```

### 4.3 🟡 DTO `BulkCreateMappingDto` غير مستخدم

**الموقع:** [apps/zkteco/src/employee-mapping/dto/create-mapping.dto.ts:14-17](apps/zkteco/src/employee-mapping/dto/create-mapping.dto.ts#L14-L17)

**الإصلاح:** إما حذفه، أو استخدامه فعلياً في `bulkCreate` مع `@ValidateNested({ each: true })`.

### 4.4 🟡 `DeviceAttendanceController` في attendance-service كود ميت

**الموقع:** [apps/attendance/src/attendance-records/device-attendance.controller.ts](apps/attendance/src/attendance-records/device-attendance.controller.ts)

**القرار:** إما:
- **(أ)** تحويل `SyncService` ليستدعي HTTP endpoint بدل `$executeRaw` (فصل مسؤوليات).
- **(ب)** حذف الـ controller + الصلاحية `attendance.records.device`.

**التوصية:** (أ) للإنتاج. الكتابة المباشرة بـ SQL raw تكسر ضمانات الـ domain (مثل validation, hooks, إلخ).

---

## 5. خطة التنفيذ المقترحة

### المرحلة 1 — أمان عاجل (يوم واحد)

- [ ] 1.1 إضافة `DeviceApiKeyGuard` على `/iclock`
- [ ] 1.2 رفض Handshake من SN مجهول
- [ ] 4.2 استثناء `/iclock` من audit interceptor

### المرحلة 2 — صحة البيانات (2-3 أيام)

- [ ] 2.1 إصلاح حساب اليوم بتوقيت Asia/Riyadh
- [ ] 2.4 التحقق من حالة الموظف (active/deleted)
- [ ] 2.3 Advisory lock على `employeeId + date`
- [ ] 3.4 تعليم البصمات المكررة بـ `DUPLICATE_IGNORED`

### المرحلة 3 — الوظائف الناقصة (أسبوع)

- [ ] 2.2 كتابة `attendance_breaks` + حساب `workedMinutes` الصحيح
- [ ] 3.1 حساب `lateMinutes` / `earlyLeaveMinutes` من schedules
- [ ] 3.2 cron لـ MISSING_CLOCK_OUT

### المرحلة 4 — تحسينات (لاحقاً)

- [ ] 3.3 دعم الوردية الليلية
- [ ] 4.1 استخدام `rawType` كـ tie-breaker
- [ ] 4.3 تنظيف `BulkCreateMappingDto`
- [ ] 4.4 قرار نهائي حول `DeviceAttendanceController`

---

## 6. اختبارات مطلوبة بعد التنفيذ

| # | الاختبار | النتيجة المتوقعة |
|---|----------|------------------|
| T1 | POST `/iclock/cdata` بـ apiKey خاطئ | 401 Unauthorized |
| T2 | POST `/iclock/cdata` بدون apiKey | 401 Unauthorized |
| T3 | بصمة في 01:30 صباحاً (Asia/Riyadh) | تاريخ السجل = نفس اليوم محلياً |
| T4 | 4 بصمات (دخول، استراحة، رجوع، خروج) | `workedMinutes = total − break` |
| T5 | 3 بصمات (دخول، استراحة، خروج) | `break` مفتوح مسجَّل، `workedMinutes` معقول |
| T6 | بصمة واحدة فقط، انتظار حتى 23:55 | يُولَّد تنبيه `MISSING_CLOCK_OUT` |
| T7 | بصمتان خلال 30 ثانية | الثانية تُعلَّم `DUPLICATE_IGNORED` |
| T8 | بصمة لموظف بـ `deletedAt IS NOT NULL` | `syncError` يُكتب، لا يُحدَّث `attendance_records` |
| T9 | 10 بصمات متزامنة لنفس الموظف | لا race conditions في القيم النهائية |
| T10 | موظف متأخر 15 دقيقة، `graceInMinutes=10` | `lateMinutes = 5` |
