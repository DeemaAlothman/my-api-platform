# دليل إصلاحات الباك إند — للمبرمج

> **للمبرمج الموكَّل بالتنفيذ**
> **تاريخ:** 2026-04-19
> **المشروع:** HR Management System (Monorepo — NestJS 10/11 + Prisma + PostgreSQL)
> **الخدمات المتأثرة:** `zkteco`, `users`, `gateway`

هذا الملف يجمع كل الثغرات والنواقص المكتشفة خلال مراجعة الكود، مع خطة تنفيذ بالأولوية.

---

## 📋 جدول المحتويات

1. [أخطاء فورية يجب إصلاحها (Hotfix)](#1-أخطاء-فورية-hotfix)
2. [ثغرات أمنية حرجة — خدمة البصمة](#2-ثغرات-أمنية-حرجة--خدمة-البصمة)
3. [أخطاء منطقية — خدمة البصمة](#3-أخطاء-منطقية--خدمة-البصمة)
4. [سيناريوهات ناقصة — خدمة البصمة](#4-سيناريوهات-ناقصة--خدمة-البصمة)
5. [تحسينات ثانوية](#5-تحسينات-ثانوية)
6. [خطة التنفيذ (4 مراحل)](#6-خطة-التنفيذ)
7. [اختبارات التحقق](#7-اختبارات-التحقق)

---

## 1. أخطاء فورية (Hotfix)

### 1.1 🔴 تعديل تاريخ التعيين لا يعمل

**الخدمة:** `apps/users`
**الملفات:**
- [apps/users/src/employees/dto/update-employee.dto.ts](apps/users/src/employees/dto/update-employee.dto.ts)
- [apps/users/src/employees/employees.service.ts](apps/users/src/employees/employees.service.ts)

**المشكلة:**
حقل `hireDate` موجود في `CreateEmployeeDto` لكن **مفقود تماماً** من `UpdateEmployeeDto`. بما أن ValidationPipe مُفعَّل بـ `whitelist: true` و `forbidNonWhitelisted: true` في [users/main.ts:27-30](apps/users/src/main.ts#L27-L30)، أي محاولة لتعديل `hireDate` عبر `PATCH /employees/:id` إما تُحذف بصمت أو تُرفض بـ 400.

**الإصلاح:**

**(أ)** في [update-employee.dto.ts](apps/users/src/employees/dto/update-employee.dto.ts) — أضِف الحقل بعد `dateOfBirth` (السطر 52 تقريباً):

```ts
@IsOptional()
@IsDateString()
hireDate?: string;
```

**(ب)** في [employees.service.ts:381](apps/users/src/employees/employees.service.ts#L381) — أضِف التحويل إلى `Date` داخل دالة `update`:

```ts
const updated = await this.prisma.employee.update({
  where: { id },
  data: {
    ...employeeData,
    dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,   // ← أضف هذا السطر
    contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : undefined,
    // ...
  },
  // ...
});
```

---

### 1.2 🔴 فلتر `?employeeId=` في قائمة البصمات مُهمَل

**الخدمة:** `apps/zkteco`
**الملفات:**
- [apps/zkteco/src/employee-mapping/employee-mapping.controller.ts](apps/zkteco/src/employee-mapping/employee-mapping.controller.ts)
- [apps/zkteco/src/employee-mapping/employee-mapping.service.ts](apps/zkteco/src/employee-mapping/employee-mapping.service.ts)

**المشكلة:**
الفرونت يستدعي `GET /employee-fingerprints?employeeId=XXX` لعرض بصمات موظف محدد، لكن الـ controller **يتجاهل الـ query param** ويرجع كل الربطات. النتيجة: كل موظف يظهر مربوطاً بكل البصمات.

**الإصلاح:**

**(أ)** في [employee-mapping.controller.ts:27-30](apps/zkteco/src/employee-mapping/employee-mapping.controller.ts#L27-L30):

```ts
import { Query } from '@nestjs/common';

@Get()
@Permission('biometric.mappings.read')
findAll(@Query('employeeId') employeeId?: string) {
  return this.employeeMappingService.findAll(employeeId);
}
```

**(ب)** في [employee-mapping.service.ts:50-55](apps/zkteco/src/employee-mapping/employee-mapping.service.ts#L50-L55):

```ts
async findAll(employeeId?: string) {
  return this.prisma.employeeFingerprint.findMany({
    where: employeeId ? { employeeId } : undefined,
    include: { device: { select: { id: true, serialNumber: true, nameAr: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
```

هذا التعديل لا يكسر أي شيء موجود (بدون query = كل الصفوف كما هو سابقاً).

---

### 1.3 🟠 جهاز البصمة لا يرسل البصمات — توسيع Body Parser

**الخدمة:** `apps/gateway` + `apps/zkteco`
**الملفات:**
- [apps/gateway/src/main.ts:48](apps/gateway/src/main.ts#L48)
- [apps/zkteco/src/main.ts:11](apps/zkteco/src/main.ts#L11)

**المشكلة:**
بعض أجهزة ZKTeco ترسل البصمات بـ Content-Type مختلف (`application/octet-stream` أو بدون Content-Type). الـ parser الحالي يقبل فقط `text/plain` → body يصل فاضي → `parseAttLogs` ترجع 0 سطور → السجل لا يُحفظ.

**الإصلاح:**

في الملفين أعلاه، استبدل:
```ts
expressApp.use(require('express').text({ type: 'text/plain', limit: '1mb' }));
```

بـ:
```ts
expressApp.use(require('express').text({
  type: (req) => {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    return ct.startsWith('text/')
      || ct.includes('octet-stream')
      || ct === ''
      || ct.includes('x-www-form-urlencoded');
  },
  limit: '1mb'
}));
```

**ملاحظة:** لا تُحوِّل لـ `type: '*/*'` لأنها تكسر JSON parsing لبقية المسارات.

---

### 1.4 🟡 صياغة exclude لـ `/iclock` في الـ gateway

**الخدمة:** `apps/gateway`
**الملف:** [apps/gateway/src/main.ts:51-53](apps/gateway/src/main.ts#L51-L53)

**المشكلة:**
الصياغة الحالية `exclude: ['iclock/(.*)']` قد لا تطابق بشكل موثوق في النسخ الحديثة من NestJS، مما يجعل `/iclock` يمرّ عبر `/api/v1` → 404.

**الإصلاح:**

```ts
import { RequestMethod } from '@nestjs/common';

app.setGlobalPrefix('api/v1', {
  exclude: [
    { path: 'iclock', method: RequestMethod.ALL },
    { path: 'iclock/*', method: RequestMethod.ALL },
  ],
});
```

---

## 2. ثغرات أمنية حرجة — خدمة البصمة

### 2.1 🔴 مسار `/iclock` مفتوح بدون مصادقة

**الملفات:**
- [apps/zkteco/src/iclock/iclock.controller.ts](apps/zkteco/src/iclock/iclock.controller.ts) — لا يوجد `@UseGuards`
- [apps/zkteco/prisma/schema.prisma:23](apps/zkteco/prisma/schema.prisma#L23) — حقل `apiKey` معرَّف لكن **غير مستخدم**

**المشكلة:**
أي شخص يعرف SN جهاز يستطيع حقن بصمات مزيفة عبر:
```
POST /iclock/cdata?SN=GDE7253402196&table=ATTLOG
```

**الإصلاح:**

**(أ)** إنشاء guard جديد:

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

    (req as any).device = device;
    return true;
  }
}
```

**(ب)** تطبيقه على `IclockController`:

```ts
import { UseGuards } from '@nestjs/common';
import { DeviceApiKeyGuard } from '../common/guards/device-api-key.guard';

@Controller('iclock')
@UseGuards(DeviceApiKeyGuard)
export class IclockController { ... }
```

**(ج)** عرض `apiKey` للإدمن عند إنشاء جهاز جديد (حالياً مخفي).

> ⚠️ **ملاحظة مهمة للتنفيذ:** بعض أجهزة ZKTeco لا تدعم إضافة headers مخصصة. لو الجهاز لا يدعم ذلك، استخدم `?apiKey=` في URL. يجب تكوين الجهاز لإرسال apiKey في كل طلب — هذا يتطلب firmware يدعم URL template custom.

---

### 2.2 🔴 رفض Handshake من SN مجهول

**الملف:** [apps/zkteco/src/iclock/iclock.service.ts:25-42](apps/zkteco/src/iclock/iclock.service.ts#L25-L42)

**المشكلة:**
الكود الحالي يطبع تحذيراً فقط ويُرجع handshake response كامل لأي SN.

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

### 2.3 🟡 Audit Interceptor يضخّم الـ logs لكل بصمة

**الملف:** [apps/zkteco/src/common/interceptors/audit.interceptor.ts:13](apps/zkteco/src/common/interceptors/audit.interceptor.ts#L13)

**الإصلاح:**

```ts
intercept(ctx, next) {
  const req = ctx.switchToHttp().getRequest();
  if (req.method === 'GET' || req.path.startsWith('/iclock')) return next.handle();
  // ... بقية الكود
}
```

---

## 3. أخطاء منطقية — خدمة البصمة

### 3.1 🔴 حساب التاريخ بتوقيت UTC بدل التوقيت المحلي

**الملف:** [apps/zkteco/src/sync/sync.service.ts:28-31, 135](apps/zkteco/src/sync/sync.service.ts#L28)

**المشكلة:**
- `setHours(0,0,0,0)` يعتمد على TZ السيرفر
- `timestamp.toISOString().split('T')[0]` يستخدم UTC
- **النتيجة:** بصمة الساعة 2:00 صباحاً بتوقيت الرياض (23:00 UTC من اليوم السابق) تُسجَّل في تاريخ خاطئ.

**الإصلاح:**

إنشاء utility:

```ts
// apps/zkteco/src/common/utils/timezone.ts
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // Asia/Riyadh = UTC+3

export function toLocalDateString(date: Date): string {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  return local.toISOString().split('T')[0];
}

export function localDayRange(date: Date): { start: Date; end: Date } {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  const start = new Date(local.getTime() - TZ_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}
```

في [sync.service.ts](apps/zkteco/src/sync/sync.service.ts):

```ts
import { toLocalDateString, localDayRange } from '../common/utils/timezone';

// استبدل حساب startOfDay/endOfDay:
const { start: startOfDay, end: endOfDay } = localDayRange(timestamp);

// استبدل dateStr:
const dateStr = toLocalDateString(timestamp);
```

---

### 3.2 🔴 BREAK_OUT / BREAK_IN لا تُكتب في `attendance_breaks`

**الملف:** [apps/zkteco/src/sync/sync.service.ts:130-207](apps/zkteco/src/sync/sync.service.ts#L130-L207)

**المشكلة:**
- بصمات الاستراحة تُفسَّر في `RawAttendanceLog.interpretedAs` فقط.
- جدول `attendance.attendance_breaks` (إن وُجد) لا يُحدَّث.
- `workedMinutes = clockOut − clockIn` بدون خصم الاستراحة → ساعات عمل خاطئة.

**الإصلاح:**

```ts
private async writeToAttendance(employeeId, timestamp, interpreted, rawLogs) {
  const dateStr = toLocalDateString(timestamp);
  // ... منطق جلب/إنشاء السجل كما هو ...

  // حذف breaks السابقة وإعادة الكتابة
  await this.prisma.$executeRaw`
    DELETE FROM attendance.attendance_breaks
    WHERE "attendanceRecordId" = ${recordId}
  `;

  const pairs = this.buildBreakPairs(interpreted);
  for (const pair of pairs) {
    const durationMinutes = pair.in
      ? Math.floor((pair.in.getTime() - pair.out.getTime()) / 60000)
      : null;
    await this.prisma.$executeRaw`
      INSERT INTO attendance.attendance_breaks
        (id, "attendanceRecordId", "breakOutTime", "breakInTime", "durationMinutes", "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid(), ${recordId}, ${pair.out}, ${pair.in ?? null},
         ${durationMinutes}, NOW(), NOW())
    `;
  }

  // حساب workedMinutes بعد خصم الاستراحات
  const totalBreakMinutes = pairs.reduce((sum, p) =>
    p.in ? sum + Math.floor((p.in.getTime() - p.out.getTime()) / 60000) : sum, 0);

  if (clockInTime && clockOutTime) {
    const gross = Math.floor((clockOutTime.getTime() - clockInTime.getTime()) / 60000);
    await this.prisma.$executeRaw`
      UPDATE attendance.attendance_records
      SET "workedMinutes" = ${gross - totalBreakMinutes},
          "breakMinutes" = ${totalBreakMinutes},
          "updatedAt" = NOW()
      WHERE id = ${recordId}
    `;
  }
}

private buildBreakPairs(interpreted) {
  const pairs: Array<{ out: Date; in?: Date }> = [];
  let current: { out: Date; in?: Date } | null = null;
  for (const item of interpreted) {
    if (item.interpretedAs === 'BREAK_OUT') {
      if (current) pairs.push(current);
      current = { out: item.timestamp };
    } else if (item.interpretedAs === 'BREAK_IN' && current) {
      current.in = item.timestamp;
      pairs.push(current);
      current = null;
    }
  }
  if (current) pairs.push(current);
  return pairs;
}
```

> ⚠️ **تحقق أولاً من وجود جدول `attendance.attendance_breaks`**. إذا غير موجود، يجب إنشاؤه في migration في `apps/attendance`.

---

### 3.3 🟠 Race Condition في استقبال بصمات متزامنة

**الملف:** [apps/zkteco/src/sync/sync.service.ts:25-76](apps/zkteco/src/sync/sync.service.ts#L25-L76)

**المشكلة:**
عند وصول بصمتين لنفس الموظف في نفس الوقت، الـ `processNewStamp` يُنفَّذ بالتوازي → قيم متضاربة في `clockOutTime`.

**الإصلاح:**

استخدام PostgreSQL advisory lock:

```ts
async processNewStamp(logId, employeeId, deviceSN, timestamp) {
  const dateStr = toLocalDateString(timestamp);
  const lockKey = this.hashLockKey(employeeId + dateStr);

  await this.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
    // ... كل منطق المعالجة داخل الـ transaction ...
  });
}

private hashLockKey(s: string): bigint {
  let hash = BigInt(2166136261);
  for (const ch of s) {
    hash ^= BigInt(ch.charCodeAt(0));
    hash = (hash * BigInt(16777619)) & BigInt('0x7FFFFFFFFFFFFFFF');
  }
  return hash;
}
```

---

### 3.4 🟠 عدم التحقق من حالة الموظف

**الملف:** [apps/zkteco/src/iclock/iclock.service.ts:156-158](apps/zkteco/src/iclock/iclock.service.ts#L156-L158)

**المشكلة:**
بصمات لموظفين محذوفين (`deletedAt IS NOT NULL`) أو غير نشطين (`status != 'ACTIVE'`) تُسجَّل عادياً.

**الإصلاح:**

```ts
const mapping = await this.prisma.employeeFingerprint.findFirst({
  where: { pin: log.pin, deviceId, isActive: true },
});

let employeeId = mapping?.employeeId ?? null;

if (employeeId) {
  const employees = await this.prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, "employmentStatus" as status FROM users.employees
    WHERE id = ${employeeId} AND "deletedAt" IS NULL
    LIMIT 1
  `;
  if (employees.length === 0 || employees[0].status !== 'ACTIVE') {
    await this.prisma.rawAttendanceLog.create({
      data: {
        deviceId, deviceSN, pin: log.pin, employeeId,
        timestamp: log.timestamp, rawType: log.rawType,
        synced: false,
        syncError: `Employee ${employeeId} inactive/deleted`,
      },
    });
    return;
  }
}
```

---

## 4. سيناريوهات ناقصة — خدمة البصمة

### 4.1 🟠 `lateMinutes` و `earlyLeaveMinutes` ثابتة = 0

**الملف:** [apps/zkteco/src/sync/sync.service.ts:173](apps/zkteco/src/sync/sync.service.ts#L173)

**المشكلة:**
القيم ثابتة بدون ربط مع schedules أو policies.

**الإصلاح:**

```ts
const schedule = await this.prisma.$queryRaw<Array<{
  startTime: string; endTime: string; graceInMinutes: number;
}>>`
  SELECT s."startTime", s."endTime", COALESCE(p."graceInMinutes", 0) as "graceInMinutes"
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
  lateMinutes = Math.max(0, diff - schedule[0].graceInMinutes);
}
if (schedule[0] && clockOutTime) {
  const [h, m] = schedule[0].endTime.split(':').map(Number);
  const scheduled = new Date(clockOutTime);
  scheduled.setHours(h, m, 0, 0);
  const diff = Math.floor((scheduled.getTime() - clockOutTime.getTime()) / 60000);
  earlyLeaveMinutes = Math.max(0, diff);
}
```

> ⚠️ **تحقق من أسماء الجداول والحقول** (`employee_schedules`, `schedules`, `attendance_policies`) قبل تطبيق الاستعلام.

---

### 4.2 🟠 لا تنبيه `MISSING_CLOCK_OUT`

**المكان:** جديد — يحتاج cron job.

**الإصلاح:**

```ts
// apps/zkteco/src/sync/missing-stamps.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { toLocalDateString } from '../common/utils/timezone';

@Injectable()
export class MissingStampsCron {
  private readonly logger = new Logger(MissingStampsCron.name);
  constructor(private prisma: PrismaService) {}

  @Cron('55 23 * * *', { timeZone: 'Asia/Riyadh' })
  async detectMissingClockOut() {
    const today = toLocalDateString(new Date());
    const records = await this.prisma.$queryRaw<Array<{ id: string; employeeId: string }>>`
      SELECT id, "employeeId" FROM attendance.attendance_records
      WHERE date = ${today}::date
        AND "clockInTime" IS NOT NULL
        AND "clockOutTime" IS NULL
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

**في `AppModule`:**

```ts
import { ScheduleModule } from '@nestjs/schedule';
import { MissingStampsCron } from './sync/missing-stamps.cron';

@Module({
  imports: [ScheduleModule.forRoot(), ...],
  providers: [..., MissingStampsCron],
})
```

**package.json:** تأكد من تثبيت `@nestjs/schedule`.

---

### 4.3 🟡 دعم الوردية الليلية

**الملف:** [apps/zkteco/src/sync/sync.service.ts:28-31](apps/zkteco/src/sync/sync.service.ts#L28-L31)

**المشكلة:** بصمة دخول 22:00 وخروج 06:00 تُعتبران يومين منفصلين.

**الإصلاح:**

```ts
function shiftDayRange(timestamp: Date, shiftType: 'DAY' | 'NIGHT') {
  if (shiftType === 'DAY') return localDayRange(timestamp);
  const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
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

> يتطلب إضافة حقل `shiftType` في `schedules` (لا يوجد حالياً حسب علمي).

---

### 4.4 🟡 تعليم البصمات المكررة بدل تركها بدون `interpretedAs`

**الملف:** [apps/zkteco/src/sync/sync.service.ts:81-96](apps/zkteco/src/sync/sync.service.ts#L81-L96)

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

// في processNewStamp، بعد جلب todayLogs:
const { kept: filteredLogs, duplicates } = this.filterDuplicates(todayLogs);
if (duplicates.length > 0) {
  await this.prisma.rawAttendanceLog.updateMany({
    where: { id: { in: duplicates } },
    data: { interpretedAs: 'DUPLICATE_IGNORED' },
  });
}
```

---

## 5. تحسينات ثانوية

### 5.1 🟡 `rawType` من الجهاز مُهمَل

**الموقع:** [apps/zkteco/src/sync/sync.service.ts](apps/zkteco/src/sync/sync.service.ts)

**التوصية:** استخدامه كـ tie-breaker عند عدد فردي من البصمات:
- `rawType=0` → يُرجّح CLOCK_IN
- `rawType=1` → يُرجّح CLOCK_OUT

---

### 5.2 🟡 `BulkCreateMappingDto` غير مستخدم

**الموقع:** [apps/zkteco/src/employee-mapping/dto/create-mapping.dto.ts:14-17](apps/zkteco/src/employee-mapping/dto/create-mapping.dto.ts#L14-L17)

**الإصلاح:** إما حذفه، أو استخدامه فعلياً في `bulkCreate` مع `@ValidateNested({ each: true })`.

---

### 5.3 🟡 `DeviceAttendanceController` كود ميت في attendance-service

**الموقع:** [apps/attendance/src/attendance-records/device-attendance.controller.ts](apps/attendance/src/attendance-records/device-attendance.controller.ts)

**المشكلة:** الـ zkteco يكتب مباشرة في DB عبر `$executeRaw` ولا يستدعي هذا الـ controller. الصلاحية `attendance.records.device` بلا استخدام فعلي.

**القرار المطلوب:**
- **(أ)** تحويل `SyncService` ليستدعي HTTP endpoint بدل `$executeRaw` → فصل مسؤوليات أفضل.
- **(ب)** حذف الـ controller والصلاحية.

**التوصية:** (أ) للإنتاج على المدى الطويل.

---

## 6. خطة التنفيذ

### المرحلة 1 — Hotfix (يوم واحد)

- [ ] 1.1 إصلاح `hireDate` في `UpdateEmployeeDto` والـ service
- [ ] 1.2 دعم `?employeeId=` في `GET /employee-fingerprints`
- [ ] 1.3 توسيع body parser لدعم content-types متعددة
- [ ] 1.4 تصحيح صيغة `exclude` في Gateway
- [ ] 2.3 استثناء `/iclock` من audit interceptor

### المرحلة 2 — أمان (2-3 أيام)

- [ ] 2.1 `DeviceApiKeyGuard` على `/iclock`
- [ ] 2.2 رفض Handshake من SN مجهول
- [ ] تحديث وثائق تكوين الجهاز (كيف يرسل apiKey)

### المرحلة 3 — صحة البيانات (3-4 أيام)

- [ ] 3.1 إصلاح حساب التاريخ بـ Asia/Riyadh
- [ ] 3.4 التحقق من حالة الموظف (active/deleted)
- [ ] 3.3 Advisory lock على `employeeId + date`
- [ ] 4.4 تعليم البصمات المكررة بـ `DUPLICATE_IGNORED`

### المرحلة 4 — وظائف جديدة (أسبوع)

- [ ] 3.2 كتابة `attendance_breaks` + حساب `workedMinutes` الصحيح
- [ ] 4.1 حساب `lateMinutes` / `earlyLeaveMinutes` من schedules
- [ ] 4.2 cron لـ `MISSING_CLOCK_OUT`

### المرحلة 5 — تحسينات لاحقة

- [ ] 4.3 دعم الوردية الليلية (يحتاج schema update)
- [ ] 5.1 استخدام `rawType` كـ tie-breaker
- [ ] 5.2 تنظيف أو استخدام `BulkCreateMappingDto`
- [ ] 5.3 قرار نهائي حول `DeviceAttendanceController`

---

## 7. اختبارات التحقق

| # | الاختبار | النتيجة المتوقعة |
|---|----------|------------------|
| T1 | `PATCH /employees/:id` مع `hireDate: "2025-03-15"` | التاريخ يُحفَظ ويظهر عند القراءة |
| T2 | `GET /employee-fingerprints?employeeId=X` | إرجاع بصمات الموظف X فقط |
| T3 | `POST /iclock/cdata` بـ Content-Type: `application/octet-stream` | البصمة تُحفظ |
| T4 | `POST /iclock/cdata` بدون apiKey | 401 Unauthorized |
| T5 | `GET /iclock/cdata?SN=UNKNOWN` | 401 |
| T6 | بصمة في 02:00 صباحاً (Asia/Riyadh) | `date` في `attendance_records` = نفس اليوم محلياً |
| T7 | 4 بصمات (in, break-out, break-in, out) | `workedMinutes = total − break`, سجل في `attendance_breaks` |
| T8 | 3 بصمات (in, break-out, out) | `break` مفتوح مُسجَّل، `workedMinutes` معقول |
| T9 | بصمة واحدة فقط، انتظار حتى 23:55 | تنبيه `MISSING_CLOCK_OUT` يُولَّد |
| T10 | بصمتان خلال 30 ثانية | الثانية تُعلَّم `DUPLICATE_IGNORED` |
| T11 | بصمة لموظف `deletedAt != NULL` | `syncError` يُكتب، لا `attendance_records` |
| T12 | 10 بصمات متزامنة لنفس الموظف | لا تضارب في القيم النهائية |
| T13 | موظف متأخر 15د، `graceInMinutes=10` | `lateMinutes = 5` |

---

## 8. ملاحظات للمبرمج

### 8.1 الموارد المرجعية في المشروع

- [BIOMETRIC_FIXES_GUIDE.md](BIOMETRIC_FIXES_GUIDE.md) — النسخة الأولى من دليل الإصلاحات (تم دمجها هنا)
- [BACKEND_BIOMETRIC_GUIDE.md](BACKEND_BIOMETRIC_GUIDE.md) — توصيف المنظومة الأصلي

### 8.2 أوامر مفيدة

```bash
# تشغيل migrations بعد أي تعديل schema
npm run db:migrate:dev

# توليد Prisma client
npm run db:generate

# إعادة تشغيل خدمة zkteco بعد التعديلات
docker compose restart zkteco

# مراقبة الـ logs
docker logs -f zkteco-service
```

### 8.3 نقاط احتياطية

1. **قبل تعديل migrations قديمة** — لا تعدلها أبداً، أنشئ migration جديد.
2. **قبل حذف أي endpoint أو DTO field** — تحقق من الفرونت إذا يستخدمه.
3. **اختبر كل تعديل بـ Postman collection موجود** قبل دفع للـ production.

### 8.4 نقاط تحتاج قرار قبل التنفيذ

- هل توجد `Asia/Riyadh` أم `Asia/Damascus` / أخرى؟ (حالياً الكود UTC+3 يناسب الإثنين).
- هل جدول `attendance_breaks` موجود أم يحتاج إنشاء؟
- هل نعتمد نموذج "كتابة مباشرة" (الحالي) أم HTTP بين zkteco و attendance؟
