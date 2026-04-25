# دليل تطبيق قواعد العمل - الحضور والرواتب والإجازات

**التاريخ:** 2026-04-25
**الجمهور:** مبرمج الباك إند
**المشروع:** `my-api-platform` (NestJS Microservices)
**المدة المقدرة:** 20-23 يوم عمل
**النوع:** Additive Implementation (لا تكسير لأي شيء قائم)

---

## القسم 0: السياق والقيود الحاكمة

### 0.1 الهدف من هذا الملف

هذا الملف يصف **بدقة تامة** التعديلات المطلوبة على نظام HR لجعله يدعم قواعد العمل الفعلية للشركة (4 ورديات + قواعد التأخير الشهرية + استثناء بدل الطعام + الإجازات الساعية + 5 تقارير) دون كسر أي شيء قائم.

### 0.2 القيد الذهبي: ممنوع لمس مسار البصمة

البصامة شغّالة في المصنع وتستقبل بصمات الموظفين. **أي تعديل يكسر هذا المسار يُعتبر فشلاً للمشروع**.

#### Do Not Touch List (قائمة الممنوع)

```
❌ apps/zkteco/src/iclock/iclock.controller.ts
❌ apps/zkteco/src/iclock/iclock.service.ts
❌ apps/zkteco/src/common/guards/device-api-key.guard.ts
❌ Table: raw_attendance_logs (only ADD COLUMN allowed, no schema breaking changes)
❌ Table: BiometricDevice (read-only for our purposes)
❌ The /iclock/cdata endpoint behavior (handshake + ATTLOG ingestion)
```

#### المسموح به

```
✅ apps/zkteco/src/sync/sync.service.ts (يمكن إضافة دوال، لا تعديل المنطق الأساسي)
✅ apps/attendance/* (كل التعديلات هنا)
✅ apps/leave/* (تعديلات schema و logic)
✅ apps/users/* (إضافات على Allowance)
✅ كل migrations: ADD COLUMN, CREATE INDEX, ADD ENUM VALUE فقط
```

### 0.3 معمارية المسار الحالي للبصمة (للفهم فقط - لا تعدل)

```
[ZKTeco Device] 
    → POST /iclock/cdata?SN=xxx&table=ATTLOG
    → DeviceApiKeyGuard validates SN exists & active
    → IclockService stores in raw_attendance_logs (synced=false)
    → SyncService (cron job) reads unsynced logs
    → calcScheduleDeltas() computes status/late/overtime
    → writeToAttendance() INSERT/UPDATE attendance_records
    → marks raw_attendance_logs.synced=true
```

**نقطة التدخل المُقترحة:** نعدّل `calcScheduleDeltas()` و `writeToAttendance()` فقط، مع backfill الذي يستخدم نفس الدوال على بيانات `raw_attendance_logs` الموجودة.

### 0.4 التحقق من المتطلبات الأساسية القائمة

قبل البدء، تأكد من وجود التالي (تم التحقق منها 2026-04-25):

| المكون | الحالة | الموقع |
|--------|--------|--------|
| `WorkSchedule` model | ✅ موجود | `apps/attendance/prisma/schema.prisma` |
| `EmployeeSchedule` model | ✅ موجود | نفس الملف |
| `AttendanceRecord` model | ✅ موجود | نفس الملف |
| `AttendanceBreak` model | ✅ موجود | نفس الملف |
| `MonthlyPayroll` model | ✅ موجود | نفس الملف |
| `DeductionPolicy` model | ✅ موجود | نفس الملف |
| `LeaveRequest` model | ✅ موجود | `apps/leave/prisma/schema.prisma` |
| `LeaveBalance` model | ✅ موجود | نفس الملف |
| `EmployeeAllowance` + `AllowanceType.FOOD` enum | ✅ موجود | `apps/users/prisma/schema.prisma` |
| `AttendanceJustification` | ✅ موجود | `apps/attendance/prisma/schema.prisma` |
| Backfill endpoints (dry-run/apply) | ✅ موجود | `apps/attendance/src/jobs/backfill.service.ts` |
| Daily Closure job | ✅ موجود | `apps/attendance/src/jobs/daily-closure.service.ts` |

---

## القسم 1: تعديلات Schema (Additive Migrations)

كل التعديلات بصيغة `ALTER TABLE ADD COLUMN` بقيم افتراضية. لا حذف، لا تعديل أعمدة موجودة، لا تعديل أنواع.

### 1.1 تعديلات `apps/attendance/prisma/schema.prisma`

#### Model: `WorkSchedule`

```prisma
model WorkSchedule {
  // ... الحقول الموجودة ...
  
  // === حقول جديدة ===
  
  /// الحد الأدنى لساعات العمل المتواصلة (بالدقائق)
  /// مفيد لوردية المحاسب: 180 دقيقة (3 ساعات متواصلة)
  /// null = لا يوجد متطلب حد أدنى (الوردية الكلاسيكية بساعات بداية ونهاية ثابتة)
  minimumWorkMinutes  Int?
  
  /// إذا true، الـ minimumWorkMinutes يجب أن يكون متواصلاً (بدون انقطاع > 1 دقيقة)
  /// إذا false، يكفي مجموع الساعات (للمستقبل)
  requiresContinuousWork Boolean @default(false)
  
  /// مضاعف الأوفرتايم في العطل الرسمية (1.5 = ساعة ونصف عن كل ساعة)
  /// null = لا يوجد مضاعف خاص
  holidayMultiplier   Float?
  
  /// نوع الوردية للتعامل مع نوبات الليل
  shiftType           ShiftType @default(DAY)
}

enum ShiftType {
  DAY
  NIGHT
  FLEXIBLE  // للورديات المرنة كوردية المحاسب
}
```

#### Model: `DeductionPolicy`

```prisma
model DeductionPolicy {
  // ... الحقول الموجودة ...
  
  /// إجمالي دقائق التأخير المسموحة شهرياً قبل بدء الخصم (default 120 = 2 ساعة)
  monthlyLateToleranceMinutes Int @default(120)
  
  /// أنواع البدلات المستثناة من الخصم (JSON array of AllowanceType)
  /// مثال: ["FOOD"] لاستثناء بدل الطعام
  excludedAllowanceTypes Json @default("[\"FOOD\"]")
  
  /// تاريخ بدء سريان السياسة (لدعم versioning)
  /// السياسة الفعّالة لأي تاريخ هي آخر سياسة effectiveFrom <= ذلك التاريخ
  effectiveFrom DateTime @default(now())
  
  @@index([effectiveFrom])
}
```

#### Model: `AttendanceRecord`

```prisma
model AttendanceRecord {
  // ... الحقول الموجودة ...
  
  /// دقائق التعويض في نهاية الدوام (لو خرج بعد workEndTime)
  /// تُطرح من lateMinutes في حساب الراتب
  lateCompensatedMinutes Int @default(0)
  
  /// أطول فترة عمل متواصلة بين البصمات (بالدقائق)
  /// يُستخدم لوردية المحاسب للتحقق من 3 ساعات متواصلة
  longestContinuousWorkMinutes Int @default(0)
  
  /// حالة تسلسل البصمات
  punchSequenceStatus PunchSequenceStatus @default(VALID)
  
  /// نافذة الإجازة الساعية (إن وجدت)
  /// مفيدة لطرح ساعات الإجازة من الدقائق المتوقّعة
  leaveStartTime DateTime?
  leaveEndTime   DateTime?
  
  /// ساعات الإجازة الساعية المطبقة على هذا اليوم (بالدقائق)
  hourlyLeaveMinutes Int @default(0)
  
  /// نسخة الحساب (للـ backfill) - يزيد كل مرة تُعاد الحسابات
  computationVersion Int @default(1)
  
  /// آخر إعادة حساب
  recomputedAt DateTime?
  
  @@index([employeeId, date, punchSequenceStatus])
}

enum PunchSequenceStatus {
  VALID       // [CLOCK_IN, (BREAK_OUT, BREAK_IN)*, CLOCK_OUT]
  PARTIAL     // ناقص بصمة خروج (ليس خطأ، لكن يحتاج مراجعة)
  INVALID     // تسلسل غير منطقي (3 BREAK_OUTs مثلاً)
  RECOMPUTED  // أُعيد حسابه يدوياً بعد PARTIAL/INVALID
}
```

#### Model: `MonthlyPayroll`

```prisma
model MonthlyPayroll {
  // ... الحقول الموجودة ...
  
  /// الراتب الأساسي القابل للخصم (basic + allowances - excludedAllowances)
  /// مثال: 5000 (basic) + 1500 (transport) + 500 (food مستثناة) = 6500 deductibleBase
  deductibleBaseSalary Decimal @db.Decimal(15, 2) @default(0)
  
  /// إجمالي البدلات (شامل كل أنواعها)
  totalAllowances Decimal @db.Decimal(15, 2) @default(0)
  
  /// إجمالي البدلات المستثناة من الخصم (مثل FOOD)
  excludedAllowancesAmount Decimal @db.Decimal(15, 2) @default(0)
  
  /// تفصيل الخصومات (JSON)
  /// {
  ///   "lateDeduction": 150.50,
  ///   "absenceDeduction": 200.00,
  ///   "breakOverLimitDeduction": 50.00,
  ///   "totalDeduction": 400.50
  /// }
  deductionBreakdown Json?
  
  /// إجمالي دقائق التأخير الشهرية (قبل تطبيق سماحية الـ 2 ساعة)
  totalLateMinutesGross Int @default(0)
  
  /// دقائق التأخير الفعّالة (بعد طرح السماحية اليومية والتعويض)
  totalLateMinutesEffective Int @default(0)
  
  /// دقائق التعويض الإجمالية (lateCompensatedMinutes الشهرية)
  totalCompensationMinutes Int @default(0)
  
  /// عدد أيام العمل في الشهر (للـ pro-rating)
  workingDaysInMonth Int @default(0)
  
  /// عدد أيام عمل الموظف الفعلية (للموظف الجديد/المنتهي)
  employeeWorkingDays Int @default(0)
  
  /// نسبة الـ pro-rating (employeeWorkingDays / workingDaysInMonth)
  proRationFactor Float @default(1.0)
  
  /// نسخة سياسة الخصم المطبقة (نسخة في وقت الحساب)
  appliedPolicySnapshot Json?
}
```

#### Model: `AttendanceComputationLog` (إذا غير موجود)

```prisma
model AttendanceComputationLog {
  id              String   @id @default(cuid())
  attendanceRecordId String?
  employeeId      String
  date            DateTime
  trigger         String   // "BIOMETRIC_SYNC" | "MANUAL_EDIT" | "BACKFILL" | "LEAVE_APPROVED" | "JUSTIFICATION_APPROVED"
  beforeSnapshot  Json?
  afterSnapshot   Json?
  computedBy      String?  // userId or "SYSTEM"
  notes           String?
  createdAt       DateTime @default(now())
  
  @@index([employeeId, date])
  @@index([trigger])
}
```

### 1.2 تعديلات `apps/leave/prisma/schema.prisma`

#### Model: `LeaveRequest`

```prisma
model LeaveRequest {
  // ... الحقول الموجودة (startDate, endDate, isHalfDay, halfDayPeriod) ...
  
  /// إجازة ساعية (إذا true، يجب ملء startTime و endTime و durationHours)
  isHourlyLeave Boolean @default(false)
  
  /// وقت بداية الإجازة الساعية (HH:mm format داخل اليوم)
  /// مثال: "14:00"
  startTime String?
  
  /// وقت نهاية الإجازة الساعية
  /// مثال: "16:00"
  endTime String?
  
  /// مدة الإجازة الساعية (ساعات بصيغة Float)
  /// مثال: 2.0 = ساعتان
  durationHours Float?
  
  /// أيام معادِلة (للحساب من الرصيد): durationHours / shiftHours
  /// مثال: 2 ساعة في وردية 8 ساعات = 0.25 يوم
  equivalentDays Float?
}
```

#### Model: `LeaveBalance`

```prisma
model LeaveBalance {
  // ... الحقول الموجودة (totalDays, usedDays, pendingDays, ...) ...
  
  /// الساعات المُستخدمة (للإجازات الساعية)
  /// مع شرط: usedDays + (usedHours / shiftHours) ≤ totalDays
  usedHours Float @default(0)
  
  /// الساعات المعلّقة (إجازات ساعية معلّقة الموافقة)
  pendingHours Float @default(0)
}
```

### 1.3 تعديلات `apps/users/prisma/schema.prisma`

#### Enum: `AllowanceType` (تأكد من وجود FOOD)

```prisma
enum AllowanceType {
  TRANSPORT
  HOUSING
  FOOD          // ← يجب أن يكون موجوداً (موجود حالياً، فقط للتأكيد)
  PHONE
  PERFORMANCE
  OTHER
}
```

#### Status جديد للحضور

```prisma
enum AttendanceStatus {
  // ... الموجود (PRESENT, ABSENT, LATE, ...) ...
  
  ON_MISSION    // مأمورية / رحلة عمل (لا يُخصم، لا يُعتبر غياباً)
  PARTIAL_LEAVE // إجازة ساعية (موجود سجل حضور لكن مع نافذة إجازة)
}
```

### 1.4 سكريبت Migration

```bash
# في apps/attendance/
npx prisma migrate dev --name add_business_rules_2026_04

# في apps/leave/
npx prisma migrate dev --name add_hourly_leave_support

# في apps/users/  
# (لا migration إذا FOOD موجود، فقط verify)
```

---

## القسم 2: قواعد الورديات الأربع

### 2.1 بيانات seed للورديات

أنشئ ملف `apps/attendance/prisma/seed-shifts.ts`:

```typescript
const shifts = [
  {
    code: 'MAIN_10_18',
    nameAr: 'الوردية الأساسية',
    workStartTime: '10:00',
    workEndTime: '18:00',
    breakDurationMin: 60,
    workDays: [0, 1, 2, 3, 4], // الأحد للخميس (أو حسب الشركة)
    lateToleranceMin: 15,
    earlyLeaveToleranceMin: 0,
    allowOvertime: true,
    maxOvertimeHours: 4,
    shiftType: 'DAY',
    minimumWorkMinutes: null,
    requiresContinuousWork: false,
  },
  {
    code: 'SECOND_9_16',
    nameAr: 'الوردية الثانية',
    workStartTime: '09:00',
    workEndTime: '16:00',
    breakDurationMin: 60,
    workDays: [0, 1, 2, 3, 4],
    lateToleranceMin: 15,
    earlyLeaveToleranceMin: 0,
    allowOvertime: true,
    maxOvertimeHours: 4,
    shiftType: 'DAY',
    minimumWorkMinutes: null,
    requiresContinuousWork: false,
  },
  {
    code: 'ACCOUNTANT_10_13',
    nameAr: 'وردية المحاسب (3 ساعات متواصلة)',
    workStartTime: '10:00',
    workEndTime: '13:00',
    breakDurationMin: 0,
    workDays: [0, 1, 2, 3, 4],
    lateToleranceMin: 15,
    earlyLeaveToleranceMin: 0,
    allowOvertime: false,
    maxOvertimeHours: 0,
    shiftType: 'FLEXIBLE',
    minimumWorkMinutes: 180,           // ← المفتاح: 3 ساعات
    requiresContinuousWork: true,      // ← يجب أن تكون متواصلة
  },
  {
    code: 'FOURTH_930_1630',
    nameAr: 'وردية 9:30 - 4:30',
    workStartTime: '09:30',
    workEndTime: '16:30',
    breakDurationMin: 60,
    workDays: [0, 1, 2, 3, 4],
    lateToleranceMin: 15,
    earlyLeaveToleranceMin: 0,
    allowOvertime: true,
    maxOvertimeHours: 4,
    shiftType: 'DAY',
    minimumWorkMinutes: null,
    requiresContinuousWork: false,
  },
];

// upsert by code
for (const shift of shifts) {
  await prisma.workSchedule.upsert({
    where: { code: shift.code },
    update: shift,
    create: shift,
  });
}
```

### 2.2 منطق وردية المحاسب (3 ساعات متواصلة)

أنشئ خدمة جديدة: `apps/attendance/src/common/services/continuous-work.service.ts`

```typescript
@Injectable()
export class ContinuousWorkService {
  /**
   * يحسب أطول فترة عمل متواصلة من سجلات البصمة لذلك اليوم
   * "المتواصلة" = بدون بريك > 1 دقيقة بين البصمات
   * 
   * @param punches مرتبة زمنياً [clockIn, breakOut?, breakIn?, clockOut?]
   * @returns أطول فترة بالدقائق
   */
  computeLongestContinuous(punches: { time: Date; type: PunchType }[]): number {
    if (punches.length < 2) return 0;
    
    let longest = 0;
    let currentStart: Date | null = null;
    
    for (const punch of punches) {
      if (punch.type === 'CLOCK_IN' || punch.type === 'BREAK_IN') {
        currentStart = punch.time;
      } else if ((punch.type === 'CLOCK_OUT' || punch.type === 'BREAK_OUT') && currentStart) {
        const minutes = (punch.time.getTime() - currentStart.getTime()) / 60000;
        if (minutes > longest) longest = minutes;
        currentStart = null;
      }
    }
    
    return Math.floor(longest);
  }
  
  /**
   * يقرر هل الموظف حقق متطلب الوردية المرنة
   */
  meetsFlexibleShiftRequirement(
    schedule: WorkSchedule,
    longestContinuous: number,
  ): boolean {
    if (!schedule.minimumWorkMinutes) return true; // وردية كلاسيكية
    if (!schedule.requiresContinuousWork) return false; // مستقبل
    return longestContinuous >= schedule.minimumWorkMinutes;
  }
}
```

### 2.3 تعديل حساب الحالة لوردية المحاسب

في `apps/attendance/src/common/services/attendance-computation.service.ts` (خدمة جديدة - راجع القسم 12):

```typescript
async computeStatus(
  record: AttendanceRecord,
  schedule: WorkSchedule,
  punches: PunchData[],
): Promise<AttendanceStatusResult> {
  
  // وردية مرنة (المحاسب)
  if (schedule.shiftType === 'FLEXIBLE' && schedule.minimumWorkMinutes) {
    const longest = this.continuousWorkService.computeLongestContinuous(punches);
    record.longestContinuousWorkMinutes = longest;
    
    if (longest >= schedule.minimumWorkMinutes) {
      return { status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 0 };
    } else {
      // حقق أقل من المطلوب - يُعتبر نصف يوم أو ينقص
      return {
        status: 'HALF_DAY',
        lateMinutes: 0,
        earlyLeaveMinutes: schedule.minimumWorkMinutes - longest,
      };
    }
  }
  
  // وردية كلاسيكية (المنطق الحالي)
  return this.computeClassicShiftStatus(record, schedule, punches);
}
```

---

## القسم 3: قاعدة التأخير (يومي 15د + شهري 2 ساعة + التعويض)

### 3.1 المنطق الكامل

```
المعادلات:
  
  // يومياً - الموجود حالياً + التعديل
  dailyLateRaw = max(0, clockInTime - workStartTime)  // بالدقائق
  dailyLateAfterTolerance = max(0, dailyLateRaw - schedule.lateToleranceMin)
  
  // التعويض - جديد
  if (clockOutTime > workEndTime) {
    excessMinutes = clockOutTime - workEndTime
    lateCompensatedMinutes = min(excessMinutes, dailyLateAfterTolerance)
  }
  
  dailyEffectiveLate = max(0, dailyLateAfterTolerance - lateCompensatedMinutes)
  
  // شهرياً - في حساب الراتب
  monthlyAccumulated = SUM(dailyEffectiveLate) for all days in month
  totalCompensation = SUM(lateCompensatedMinutes) for all days
  
  monthlyDeductibleLate = max(0, monthlyAccumulated - policy.monthlyLateToleranceMinutes)
  // monthlyDeductibleLate = الدقائق التي ستُخصم فعلياً
```

### 3.2 تطبيق المنطق

في `apps/attendance/src/common/services/attendance-computation.service.ts`:

```typescript
computeLatenessAndCompensation(
  clockInTime: Date,
  clockOutTime: Date | null,
  schedule: WorkSchedule,
  effectiveShiftStart: Date,  // قد تكون مختلفة في حالة نصف اليوم
  effectiveShiftEnd: Date,
): { lateMinutes: number; lateCompensatedMinutes: number } {
  
  const lateRaw = Math.max(0,
    Math.floor((clockInTime.getTime() - effectiveShiftStart.getTime()) / 60000)
  );
  
  // طرح السماحية اليومية
  const lateAfterTolerance = Math.max(0, lateRaw - schedule.lateToleranceMin);
  
  // حساب التعويض
  let compensation = 0;
  if (clockOutTime && clockOutTime > effectiveShiftEnd) {
    const excess = Math.floor(
      (clockOutTime.getTime() - effectiveShiftEnd.getTime()) / 60000
    );
    compensation = Math.min(excess, lateAfterTolerance);
  }
  
  return {
    lateMinutes: lateAfterTolerance,
    lateCompensatedMinutes: compensation,
  };
}
```

### 3.3 تطبيق حد الـ 2 ساعة الشهرية في الراتب

في `apps/attendance/src/payroll/payroll.service.ts`، عدّل دالة `generateMonthlyPayroll`:

```typescript
async generateMonthlyPayroll(employeeId: string, year: number, month: number) {
  const records = await this.getMonthRecords(employeeId, year, month);
  const policy = await this.getEffectivePolicy(year, month);
  const justifications = await this.getApprovedJustifications(employeeId, year, month);
  
  // === حساب التأخير الشهري ===
  let totalLateMinutesGross = 0;        // قبل أي طرح
  let totalCompensationMinutes = 0;
  let justifiedLateMinutes = 0;
  
  for (const record of records) {
    totalLateMinutesGross += record.lateMinutes || 0;
    totalCompensationMinutes += record.lateCompensatedMinutes || 0;
    
    // التبريرات المعتمدة لهذا اليوم
    const dayJustifications = justifications.filter(
      j => isSameDay(j.date, record.date) && j.type === 'LATE'
    );
    justifiedLateMinutes += dayJustifications.reduce(
      (sum, j) => sum + (j.minutesJustified || 0), 0
    );
  }
  
  // التأخير الفعّال بعد التعويض والمبررات
  const totalLateEffective = Math.max(0,
    totalLateMinutesGross - totalCompensationMinutes - justifiedLateMinutes
  );
  
  // التأخير القابل للخصم بعد سماحية الـ 2 ساعة
  const deductibleLateMinutes = Math.max(0,
    totalLateEffective - policy.monthlyLateToleranceMinutes
  );
  
  // ... استخدم deductibleLateMinutes في حساب lateDeduction (القسم 4)
}
```

---

## القسم 4: حساب الراتب مع استثناء بدل الطعام

### 4.1 الصيغ الكاملة

```
// ملاحظة: كل الحسابات بـ deductibleBase وليس gross

excludedAllowances = SUM(allowances WHERE type IN policy.excludedAllowanceTypes)
totalAllowances    = SUM(all allowances)
deductibleBase     = basicSalary + totalAllowances - excludedAllowances

// pro-rating إذا الموظف لم يعمل الشهر كاملاً
proRationFactor    = employeeWorkingDays / workingDaysInMonth
proRatedDeductible = deductibleBase * proRationFactor

// معدل الدقيقة (يستخدم deductibleBase وليس gross)
shiftMinutesPerDay = (workEndTime - workStartTime) - breakDurationMin
totalShiftMinutes  = shiftMinutesPerDay * workingDaysInMonth
minuteRate         = proRatedDeductible / totalShiftMinutes

// الخصومات
lateDeduction         = deductibleLateMinutes * minuteRate
absenceDeduction      = absenceDays * shiftMinutesPerDay * minuteRate
breakOverLimitDeduct  = breakOverLimitMinutes * minuteRate

totalDeduction = lateDeduction + absenceDeduction + breakOverLimitDeduct

// الراتب الصافي
gross = (basicSalary + totalAllowances) * proRationFactor + overtimePay
net   = gross - totalDeduction
```

### 4.2 التطبيق في `payroll.service.ts`

```typescript
async generateMonthlyPayroll(employeeId: string, year: number, month: number) {
  const employee = await this.usersClient.getEmployee(employeeId);
  const allowances = await this.usersClient.getEmployeeAllowances(employeeId);
  const policy = await this.getEffectivePolicy(year, month);
  const records = await this.getMonthRecords(employeeId, year, month);
  
  // === حساب الـ pro-rating ===
  const workingDaysInMonth = this.calculateWorkingDays(year, month, employee.scheduleId);
  const employeeWorkingDays = this.calculateEmployeeWorkingDays(
    employee.hireDate,
    employee.terminationDate,
    year, month
  );
  const proRationFactor = employeeWorkingDays / workingDaysInMonth;
  
  // === البدلات ===
  const excludedTypes = JSON.parse(policy.excludedAllowanceTypes as string); // ["FOOD"]
  const totalAllowances = allowances.reduce((s, a) => s + Number(a.amount), 0);
  const excludedAllowances = allowances
    .filter(a => excludedTypes.includes(a.type))
    .reduce((s, a) => s + Number(a.amount), 0);
  
  const basicSalary = Number(employee.basicSalary);
  const deductibleBase = basicSalary + totalAllowances - excludedAllowances;
  const proRatedDeductible = deductibleBase * proRationFactor;
  
  // === التأخير الشهري (راجع القسم 3.3) ===
  const { totalLateGross, totalCompensation, deductibleLateMinutes } =
    this.computeMonthlyLateness(records, policy);
  
  // === الغياب ===
  const absenceDays = records.filter(r => r.status === 'ABSENT').length;
  
  // === Break over limit (الموجود حالياً) ===
  const breakOverLimitMinutes = this.computeBreakOverLimit(records, policy);
  
  // === حساب الخصومات ===
  const schedule = await this.getEmployeeSchedule(employeeId);
  const shiftMinutesPerDay = this.computeShiftMinutes(schedule);
  const totalShiftMinutes = shiftMinutesPerDay * workingDaysInMonth;
  const minuteRate = proRatedDeductible / totalShiftMinutes;
  
  const lateDeduction = deductibleLateMinutes * minuteRate;
  const absenceDeduction = absenceDays * shiftMinutesPerDay * minuteRate;
  const breakDeduction = breakOverLimitMinutes * minuteRate;
  const totalDeduction = lateDeduction + absenceDeduction + breakDeduction;
  
  // === الأوفرتايم ===
  const overtimePay = await this.computeOvertimePay(records, basicSalary, schedule);
  
  // === الإجمالي والصافي ===
  const grossSalary = (basicSalary + totalAllowances) * proRationFactor + overtimePay;
  const netSalary = grossSalary - totalDeduction;
  
  // === الكتابة ===
  return await this.prisma.monthlyPayroll.upsert({
    where: { employeeId_year_month: { employeeId, year, month } },
    update: { /* ... */ },
    create: {
      employeeId,
      year,
      month,
      basicSalary,
      totalAllowances,
      excludedAllowancesAmount: excludedAllowances,
      deductibleBaseSalary: deductibleBase,
      workingDaysInMonth,
      employeeWorkingDays,
      proRationFactor,
      totalLateMinutesGross: totalLateGross,
      totalLateMinutesEffective: deductibleLateMinutes,
      totalCompensationMinutes: totalCompensation,
      overtimePay,
      grossSalary,
      netSalary,
      deductionBreakdown: {
        lateDeduction: lateDeduction.toFixed(2),
        absenceDeduction: absenceDeduction.toFixed(2),
        breakOverLimitDeduction: breakDeduction.toFixed(2),
        totalDeduction: totalDeduction.toFixed(2),
      },
      appliedPolicySnapshot: { // snapshot للـ versioning
        monthlyLateToleranceMinutes: policy.monthlyLateToleranceMinutes,
        excludedAllowanceTypes: policy.excludedAllowanceTypes,
        effectiveFrom: policy.effectiveFrom,
      },
      status: 'DRAFT',
    },
  });
}
```

---

## القسم 5: الإجازات الساعية

### 5.1 منطق التحويل من رصيد سنوي

```
// المبدأ: 1 يوم = ساعات الوردية المخصصة للموظف

shiftHours = (workEndTime - workStartTime) / 60  // مثال: 8 ساعات

// حساب أيام معادِلة
equivalentDays = durationHours / shiftHours

// التحقق من الرصيد
remainingDays = totalDays - usedDays - (usedHours / shiftHours)
if (equivalentDays > remainingDays) {
  throw new BadRequestException('رصيد الإجازة غير كافٍ');
}
```

### 5.2 DTO جديد

`apps/leave/src/leave-requests/dto/create-hourly-leave.dto.ts`:

```typescript
import { IsString, IsNotEmpty, Matches, IsDateString, IsOptional } from 'class-validator';

export class CreateHourlyLeaveDto {
  @IsString() @IsNotEmpty()
  leaveTypeId: string;
  
  @IsDateString()
  date: string; // YYYY-MM-DD - يوم واحد فقط
  
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime يجب أن يكون HH:mm' })
  startTime: string;
  
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime يجب أن يكون HH:mm' })
  endTime: string;
  
  @IsString() @IsOptional()
  reason?: string;
}
```

### 5.3 Endpoint و Service

`apps/leave/src/leave-requests/leave-requests.controller.ts`:

```typescript
@Post('hourly')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permission('leave_requests:create')
async createHourlyLeave(
  @Body() dto: CreateHourlyLeaveDto,
  @CurrentEmployee() employeeId: string,
) {
  return this.service.createHourlyLeave(employeeId, dto);
}
```

`apps/leave/src/leave-requests/leave-requests.service.ts`:

```typescript
async createHourlyLeave(employeeId: string, dto: CreateHourlyLeaveDto) {
  // حساب المدة
  const [sh, sm] = dto.startTime.split(':').map(Number);
  const [eh, em] = dto.endTime.split(':').map(Number);
  const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
  
  if (durationMinutes <= 0) {
    throw new BadRequestException('endTime يجب أن يكون بعد startTime');
  }
  
  const durationHours = durationMinutes / 60;
  
  // الحصول على وردية الموظف
  const schedule = await this.attendanceClient.getEmployeeSchedule(employeeId);
  const shiftHours = this.computeShiftHours(schedule);
  const equivalentDays = durationHours / shiftHours;
  
  // التحقق من الرصيد
  const balance = await this.prisma.leaveBalance.findFirst({
    where: { employeeId, leaveTypeId: dto.leaveTypeId, year: new Date(dto.date).getFullYear() }
  });
  if (!balance) throw new NotFoundException('لا يوجد رصيد إجازة');
  
  const remainingDays = balance.totalDays
    - balance.usedDays
    - (balance.usedHours / shiftHours)
    - balance.pendingDays
    - (balance.pendingHours / shiftHours);
  
  if (equivalentDays > remainingDays) {
    throw new BadRequestException(
      `رصيد الإجازة غير كافٍ. المتاح: ${remainingDays.toFixed(2)} يوم`
    );
  }
  
  // إنشاء الطلب
  const request = await this.prisma.leaveRequest.create({
    data: {
      employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: new Date(dto.date),
      endDate: new Date(dto.date),
      isHourlyLeave: true,
      startTime: dto.startTime,
      endTime: dto.endTime,
      durationHours,
      equivalentDays,
      reason: dto.reason,
      status: 'PENDING_MANAGER',
    },
  });
  
  // تحديث pendingHours
  await this.prisma.leaveBalance.update({
    where: { id: balance.id },
    data: { pendingHours: { increment: durationHours } },
  });
  
  return request;
}
```

### 5.4 عند الموافقة - تحديث الرصيد و AttendanceRecord

```typescript
async approveHourlyLeave(requestId: string, approverId: string) {
  const request = await this.prisma.leaveRequest.findUnique({ where: { id: requestId } });
  if (!request.isHourlyLeave) throw new BadRequestException();
  
  await this.prisma.$transaction([
    // 1. تحديث الرصيد
    this.prisma.leaveBalance.update({
      where: { /* ... */ },
      data: {
        pendingHours: { decrement: request.durationHours },
        usedHours: { increment: request.durationHours },
      },
    }),
    
    // 2. تحديث الحالة
    this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', approvedAt: new Date() },
    }),
  ]);
  
  // 3. ربط مع AttendanceRecord (ينفّذ event للـ attendance service)
  await this.attendanceClient.applyHourlyLeaveToRecord({
    employeeId: request.employeeId,
    date: request.startDate,
    startTime: request.startTime,
    endTime: request.endTime,
    minutes: Math.floor(request.durationHours * 60),
  });
}
```

### 5.5 طبق الإجازة الساعية على سجل الحضور

في `apps/attendance/src/attendance-records/attendance-records.service.ts`:

```typescript
async applyHourlyLeaveToRecord(data: {
  employeeId: string;
  date: Date;
  startTime: string;
  endTime: string;
  minutes: number;
}) {
  // ابحث عن سجل اليوم (قد يكون موجوداً من البصمة)
  const existing = await this.prisma.attendanceRecord.findFirst({
    where: {
      employeeId: data.employeeId,
      date: startOfDay(data.date),
    },
  });
  
  const [sh, sm] = data.startTime.split(':').map(Number);
  const [eh, em] = data.endTime.split(':').map(Number);
  const leaveStart = setMinutes(setHours(data.date, sh), sm);
  const leaveEnd = setMinutes(setHours(data.date, eh), em);
  
  if (existing) {
    // أضف نافذة الإجازة، أعد الحساب
    await this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        leaveStartTime: leaveStart,
        leaveEndTime: leaveEnd,
        hourlyLeaveMinutes: data.minutes,
        status: existing.clockInTime ? 'PARTIAL_LEAVE' : 'ON_LEAVE',
      },
    });
    
    // أعد حساب الـ deltas (سيُطرح minutes من المتوقّع)
    await this.computationService.recompute(existing.id);
    
  } else {
    // لا يوجد سجل - أنشئ سجل بإجازة ساعية فقط
    await this.prisma.attendanceRecord.create({
      data: {
        employeeId: data.employeeId,
        date: startOfDay(data.date),
        status: 'ON_LEAVE',
        leaveStartTime: leaveStart,
        leaveEndTime: leaveEnd,
        hourlyLeaveMinutes: data.minutes,
      },
    });
  }
  
  // audit log
  await this.logComputation({
    employeeId: data.employeeId,
    date: data.date,
    trigger: 'LEAVE_APPROVED',
    notes: `Hourly leave ${data.startTime}-${data.endTime} applied`,
  });
}
```

### 5.6 طرح ساعات الإجازة من الدقائق المتوقّعة

في `attendance-computation.service.ts`، في حساب التأخير:

```typescript
computeLateness(record: AttendanceRecord, schedule: WorkSchedule) {
  const expectedStart = this.getEffectiveShiftStart(record, schedule);
  const expectedEnd = this.getEffectiveShiftEnd(record, schedule);
  
  // الدقائق المتوقّعة الفعلية = ساعات الوردية - ساعات الإجازة الساعية
  const expectedMinutes = differenceInMinutes(expectedEnd, expectedStart) 
                          - record.hourlyLeaveMinutes;
  
  // ... حساب التأخير على expectedMinutes الجديد
}
```

---

## القسم 6: نصف اليوم + التأخير (الوردية الفعلية تتغير)

### 6.1 منطق `effectiveShiftStart`

في `attendance-computation.service.ts`:

```typescript
getEffectiveShiftStart(record: AttendanceRecord, schedule: WorkSchedule): Date {
  const day = startOfDay(record.date);
  const [sh, sm] = schedule.workStartTime.split(':').map(Number);
  const shiftStart = setMinutes(setHours(day, sh), sm);
  
  // إذا في إجازة نصف يوم AM، الوردية تبدأ في المنتصف
  if (record.halfDayPeriod === 'AM') {
    const [eh, em] = schedule.workEndTime.split(':').map(Number);
    const shiftEnd = setMinutes(setHours(day, eh), em);
    const middle = new Date((shiftStart.getTime() + shiftEnd.getTime()) / 2);
    return middle;
  }
  
  return shiftStart;
}

getEffectiveShiftEnd(record: AttendanceRecord, schedule: WorkSchedule): Date {
  const day = startOfDay(record.date);
  const [eh, em] = schedule.workEndTime.split(':').map(Number);
  const shiftEnd = setMinutes(setHours(day, eh), em);
  
  // إذا في إجازة نصف يوم PM، الوردية تنتهي في المنتصف
  if (record.halfDayPeriod === 'PM') {
    const [sh, sm] = schedule.workStartTime.split(':').map(Number);
    const shiftStart = setMinutes(setHours(day, sh), sm);
    const middle = new Date((shiftStart.getTime() + shiftEnd.getTime()) / 2);
    return middle;
  }
  
  return shiftEnd;
}
```

---

## القسم 7: Daily Closure مع وعي بالإجازات

### 7.1 تعديل `daily-closure.service.ts`

```typescript
@Injectable()
export class DailyClosureService {
  // ... الكود الموجود ...
  
  async runClosureForDate(date: Date) {
    const employees = await this.getActiveEmployees();
    
    for (const employee of employees) {
      const schedule = await this.getEffectiveSchedule(employee.id, date);
      const isWorkDay = this.isWorkDay(date, schedule);
      
      if (!isWorkDay) continue; // عطلة أسبوعية
      
      const isHoliday = await this.isPublicHoliday(date);
      if (isHoliday) continue; // عطلة رسمية
      
      // === جديد: فحص الإجازات المعتمدة ===
      const approvedLeave = await this.leaveClient.getApprovedLeaveForDate(
        employee.id, date
      );
      if (approvedLeave) {
        // الموظف بإجازة معتمدة - أنشئ/حدّث السجل بـ ON_LEAVE
        await this.upsertLeaveRecord(employee.id, date, approvedLeave);
        continue;
      }
      
      // === جديد: فحص المأموريات ===
      const mission = await this.requestsClient.getApprovedMissionForDate(
        employee.id, date
      );
      if (mission) {
        await this.upsertMissionRecord(employee.id, date, mission);
        continue;
      }
      
      // المنطق الموجود: فحص البصمة
      const record = await this.prisma.attendanceRecord.findFirst({
        where: { employeeId: employee.id, date: startOfDay(date) },
      });
      
      if (!record) {
        // غياب
        await this.createAbsentRecord(employee.id, date);
      } else if (record.clockInTime && !record.clockOutTime) {
        // نسي بصمة الخروج
        await this.createMissingClockOutAlert(record);
      }
    }
  }
  
  private async upsertLeaveRecord(employeeId: string, date: Date, leave: any) {
    await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date: startOfDay(date) } },
      update: {
        // لو موجود سجل ببصمة، لا نمسح البصمة، فقط نضع leaveStart/End
        leaveStartTime: leave.startTime ? this.parseLeaveTime(date, leave.startTime) : null,
        leaveEndTime: leave.endTime ? this.parseLeaveTime(date, leave.endTime) : null,
        status: leave.isHourlyLeave ? 'PARTIAL_LEAVE' : 'ON_LEAVE',
      },
      create: {
        employeeId,
        date: startOfDay(date),
        status: 'ON_LEAVE',
        leaveStartTime: leave.startTime ? this.parseLeaveTime(date, leave.startTime) : null,
        leaveEndTime: leave.endTime ? this.parseLeaveTime(date, leave.endTime) : null,
        hourlyLeaveMinutes: leave.isHourlyLeave ? leave.durationHours * 60 : 0,
      },
    });
  }
}
```

### 7.2 endpoint جديد في leave-service يحتاجه daily-closure

`apps/leave/src/leave-requests/leave-requests.controller.ts`:

```typescript
@Get('approved-for-date')
@UseGuards(InternalServiceGuard) // أو JWT داخلي
async getApprovedLeaveForDate(
  @Query('employeeId') employeeId: string,
  @Query('date') date: string,
) {
  return this.service.findApprovedLeaveForDate(employeeId, new Date(date));
}
```

---

## القسم 8: تكامل التبريرات مع الراتب

### 8.1 منطق التبريرات (موجود حالياً يحتاج توصيل)

في `payroll.service.ts` (مذكور في القسم 3.3):

```typescript
private async getApprovedJustifications(
  employeeId: string,
  year: number,
  month: number,
): Promise<AttendanceJustification[]> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  
  return this.prisma.attendanceJustification.findMany({
    where: {
      employeeId,
      date: { gte: monthStart, lte: monthEnd },
      status: 'APPROVED', // فقط المعتمدة
    },
  });
}
```

ثم في حساب التأخير:

```typescript
const justifiedLateMinutes = justifications
  .filter(j => j.type === 'LATE')
  .reduce((sum, j) => sum + (j.minutesJustified || 0), 0);

const justifiedAbsenceDays = justifications
  .filter(j => j.type === 'ABSENCE')
  .length; // كل يوم غياب مبرر = يوم لا يُخصم
```

### 8.2 تأكد من حقل `minutesJustified` على `AttendanceJustification`

```prisma
model AttendanceJustification {
  // ... الموجود ...
  
  /// الدقائق المُبرَّرة (لو type=LATE)
  minutesJustified Int?
  
  /// نوع التبرير
  type JustificationType  // LATE | ABSENCE | EARLY_LEAVE | MISSING_PUNCH
}
```

---

## القسم 9: الإجازة المعلّقة → المعتمدة (Backfill تلقائي)

### 9.1 المشكلة

موظف قدّم إجازة لكن المدير لم يوافق بعد. لم يحضر يومها. السجل: ABSENT. لاحقاً تتم الموافقة. **يجب تحديث السجل تلقائياً.**

### 9.2 Event Handler

في `apps/leave/src/leave-requests/leave-requests.service.ts`:

```typescript
async approveLeave(requestId: string, approverId: string) {
  // ... منطق الموافقة الموجود ...
  
  // === جديد: backfill للسجلات المتأثرة ===
  const request = await this.prisma.leaveRequest.findUnique({ where: { id: requestId } });
  
  // اطلب من attendance-service إعادة حساب السجلات للأيام المغطاة
  await this.attendanceClient.recomputeForLeaveApproval({
    employeeId: request.employeeId,
    startDate: request.startDate,
    endDate: request.endDate,
    leaveRequestId: request.id,
    isHourlyLeave: request.isHourlyLeave,
    startTime: request.startTime,
    endTime: request.endTime,
  });
}
```

### 9.3 Endpoint جديد في attendance-service

```typescript
@Post('internal/recompute-for-leave')
@UseGuards(InternalServiceGuard)
async recomputeForLeaveApproval(@Body() dto: RecomputeForLeaveDto) {
  const days = eachDayOfInterval({ start: dto.startDate, end: dto.endDate });
  
  for (const day of days) {
    await this.computationService.recomputeWithLeave(dto.employeeId, day, dto);
    
    await this.logComputation({
      employeeId: dto.employeeId,
      date: day,
      trigger: 'LEAVE_APPROVED',
      notes: `Recomputed after leave ${dto.leaveRequestId} approved`,
    });
  }
}
```

---

## القسم 10: وصول البصمة بعد الإغلاق اليومي

### 10.1 المشكلة

الإغلاق اليومي 21:00 UTC. بصمة وصلت 22:00 (تأخير شبكة) → السجل أُغلق وعليه ABSENT.

### 10.2 الحل

في `sync.service.ts` (دالة المزامنة الموجودة)، أضف فحص:

```typescript
async writeToAttendance(rawLog: RawAttendanceLog) {
  // ... المنطق الموجود ...
  
  const existing = await this.prisma.attendanceRecord.findFirst({
    where: { employeeId, date: startOfDay(punchDate) },
  });
  
  // === جديد: لو السجل موجود و status=ABSENT لكن وصلت بصمة، أعد الحساب ===
  if (existing && existing.status === 'ABSENT') {
    this.logger.warn(
      `Late punch arrived for record ${existing.id}, recomputing from ABSENT`
    );
    
    // امسح ABSENT، اعمل recompute
    await this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { status: 'PRESENT', recomputedAt: new Date() },
    });
    
    await this.logComputation({
      employeeId,
      date: punchDate,
      trigger: 'LATE_PUNCH_ARRIVAL',
      notes: 'Punch arrived after daily closure',
    });
  }
  
  // ... باقي المنطق
}
```

---

## القسم 11: MISSING_CLOCK_OUT و pro-rated salary

### 11.1 سياسة MISSING_CLOCK_OUT

```typescript
// في payroll.service.ts
private handleMissingClockOut(record: AttendanceRecord, schedule: WorkSchedule) {
  if (!record.clockInTime || record.clockOutTime) return; // ليست هذه الحالة
  
  const daysSince = differenceInDays(new Date(), record.date);
  
  if (daysSince >= 2) {
    // أكثر من 48 ساعة بدون إغلاق من HR → يُعتبر نصف يوم
    record.computedStatus = 'HALF_DAY';
    record.workedMinutes = this.computeShiftMinutes(schedule) / 2;
  }
  // أقل من 48 ساعة: HR لم تتدخل بعد، نتركه partial
}
```

### 11.2 pro-rated للموظف الجديد/المنتهي

```typescript
private calculateEmployeeWorkingDays(
  hireDate: Date,
  terminationDate: Date | null,
  year: number,
  month: number,
): number {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // آخر يوم
  
  const effectiveStart = hireDate > monthStart ? hireDate : monthStart;
  const effectiveEnd = terminationDate && terminationDate < monthEnd
    ? terminationDate : monthEnd;
  
  if (effectiveStart > effectiveEnd) return 0;
  
  // عد أيام العمل (استبعد الجمع/السبت أو حسب الوردية)
  return this.countWorkingDays(effectiveStart, effectiveEnd);
}
```

---

## القسم 12: التحقق من تسلسل البصمات (Additive)

### 12.1 خدمة جديدة

`apps/attendance/src/common/services/punch-validator.service.ts`:

```typescript
@Injectable()
export class PunchValidatorService {
  validateSequence(punches: { type: PunchType; time: Date }[]): PunchSequenceStatus {
    if (punches.length === 0) return 'PARTIAL';
    if (punches.length === 1 && punches[0].type === 'CLOCK_IN') return 'PARTIAL';
    
    // فحص الترتيب الزمني
    for (let i = 1; i < punches.length; i++) {
      if (punches[i].time < punches[i - 1].time) {
        return 'INVALID'; // بصمة وصلت قبل التي قبلها
      }
    }
    
    // فحص نمط [CLOCK_IN, (BREAK_OUT, BREAK_IN)*, CLOCK_OUT]
    if (punches[0].type !== 'CLOCK_IN') return 'INVALID';
    
    if (punches[punches.length - 1].type !== 'CLOCK_OUT') {
      return 'PARTIAL'; // ناقص بصمة خروج
    }
    
    // فحص تناوب BREAK_OUT/BREAK_IN في الوسط
    let expectingBreakOut = true;
    for (let i = 1; i < punches.length - 1; i++) {
      const expected = expectingBreakOut ? 'BREAK_OUT' : 'BREAK_IN';
      if (punches[i].type !== expected) return 'INVALID';
      expectingBreakOut = !expectingBreakOut;
    }
    
    if (!expectingBreakOut) return 'INVALID'; // BREAK_OUT بدون BREAK_IN
    
    return 'VALID';
  }
}
```

### 12.2 استخدامها في sync.service (بدون كسر المنطق)

```typescript
// في writeToAttendance
const sequenceStatus = this.punchValidator.validateSequence(interpretedPunches);
record.punchSequenceStatus = sequenceStatus;

if (sequenceStatus === 'INVALID' || sequenceStatus === 'PARTIAL') {
  // أنشئ تنبيه فقط، لا ترفض السجل
  await this.alertService.createAlert({
    type: 'PUNCH_SEQUENCE_ISSUE',
    employeeId,
    date: punchDate,
    severity: sequenceStatus === 'INVALID' ? 'HIGH' : 'MEDIUM',
    message: `تسلسل بصمات ${sequenceStatus} - يحتاج مراجعة`,
  });
}
```

---

## القسم 13: التقارير الخمسة الجديدة

### 13.1 تقرير ملخص الرواتب الشهرية

#### Endpoint
```
GET /api/v1/attendance-reports/payroll-summary
Query: year, month, departmentId? (optional)
```

#### Response
```json
{
  "period": { "year": 2026, "month": 4 },
  "department": { "id": "...", "name": "Engineering" } | null,
  "totals": {
    "employeeCount": 45,
    "totalGross": 250000.00,
    "totalAllowances": 50000.00,
    "totalExcludedAllowances": 4500.00,
    "totalDeductions": {
      "late": 1200.50,
      "absence": 3500.00,
      "breakOverLimit": 800.00,
      "total": 5500.50
    },
    "totalNet": 244499.50,
    "totalOvertimePay": 12000.00
  },
  "employees": [
    {
      "employeeId": "...",
      "name": "...",
      "gross": 7500.00,
      "deductions": 250.00,
      "net": 7250.00
    }
  ]
}
```

#### Service Method
```typescript
async getPayrollSummary(year: number, month: number, departmentId?: string) {
  const where: any = { year, month };
  if (departmentId) where.employee = { departmentId };
  
  const payrolls = await this.prisma.monthlyPayroll.findMany({
    where,
    include: { employee: { select: { firstName: true, lastName: true, departmentId: true } } },
  });
  
  // aggregations
  const totals = payrolls.reduce((acc, p) => {
    const breakdown = p.deductionBreakdown as any || {};
    return {
      employeeCount: acc.employeeCount + 1,
      totalGross: acc.totalGross + Number(p.grossSalary),
      totalAllowances: acc.totalAllowances + Number(p.totalAllowances),
      totalExcludedAllowances: acc.totalExcludedAllowances + Number(p.excludedAllowancesAmount),
      lateD: acc.lateD + Number(breakdown.lateDeduction || 0),
      absenceD: acc.absenceD + Number(breakdown.absenceDeduction || 0),
      breakD: acc.breakD + Number(breakdown.breakOverLimitDeduction || 0),
      totalNet: acc.totalNet + Number(p.netSalary),
      totalOvertimePay: acc.totalOvertimePay + Number(p.overtimePay || 0),
    };
  }, { /* zero values */ });
  
  return {
    period: { year, month },
    department: departmentId ? await this.usersClient.getDepartment(departmentId) : null,
    totals: { /* ... shape from above ... */ },
    employees: payrolls.map(p => ({ /* ... */ })),
  };
}
```

### 13.2 تقرير تفصيل الخصومات

#### Endpoint
```
GET /api/v1/attendance-reports/deduction-breakdown
Query: year, month, departmentId?, employeeId?
```

#### Response
```json
{
  "period": { "year": 2026, "month": 4 },
  "rows": [
    {
      "employeeId": "...",
      "employeeName": "أحمد محمد",
      "departmentName": "المحاسبة",
      "totalLateMinutes": 145,
      "compensatedMinutes": 30,
      "deductibleLateMinutes": 0,    // لأن 145-30 = 115 < 120
      "lateDeductionAmount": 0.00,
      "absenceDays": 1,
      "absenceDeductionAmount": 250.00,
      "breakOverLimitMinutes": 30,
      "breakDeductionAmount": 31.25,
      "totalDeduction": 281.25
    }
  ]
}
```

### 13.3 تقرير الحضور بالقسم

#### Endpoint
```
GET /api/v1/attendance-reports/department-attendance
Query: year, month, departmentId
```

#### Response
```json
{
  "department": { "id": "...", "name": "..." },
  "period": { "year": 2026, "month": 4 },
  "summary": {
    "employeeCount": 12,
    "totalWorkingDays": 240,
    "totalPresent": 220,
    "totalAbsent": 8,
    "totalLate": 35,
    "totalOnLeave": 12,
    "totalLateMinutes": 1245,
    "totalOvertimeMinutes": 360,
    "averageLatenessPerEmployee": 103.75
  },
  "employees": [
    {
      "employeeId": "...",
      "name": "...",
      "presentDays": 18,
      "absentDays": 1,
      "lateDays": 3,
      "onLeaveDays": 2,
      "lateMinutes": 45,
      "overtimeMinutes": 30
    }
  ]
}
```

### 13.4 تقرير التأخر التراكمي

#### Endpoint
```
GET /api/v1/attendance-reports/lateness-accumulated
Query: year, month, departmentId?
```

#### Response
```json
{
  "period": { "year": 2026, "month": 4 },
  "monthlyTolerance": 120,
  "rows": [
    {
      "employeeId": "...",
      "employeeName": "...",
      "totalLateMinutes": 165,
      "compensationMinutes": 30,
      "justifiedMinutes": 15,
      "effectiveLateMinutes": 120,
      "exceedsToleranceBy": 0,
      "willBeDeducted": false
    },
    {
      "employeeId": "...",
      "employeeName": "...",
      "totalLateMinutes": 200,
      "compensationMinutes": 0,
      "justifiedMinutes": 0,
      "effectiveLateMinutes": 200,
      "exceedsToleranceBy": 80,
      "willBeDeducted": true
    }
  ]
}
```

### 13.5 بطاقة الموظف (يوم بيوم)

#### Endpoint
```
GET /api/v1/attendance-reports/employee-card/:employeeId
Query: year, month
```

#### Response
```json
{
  "employee": { "id": "...", "name": "...", "scheduleName": "الوردية الأساسية" },
  "period": { "year": 2026, "month": 4 },
  "days": [
    {
      "date": "2026-04-01",
      "dayOfWeek": "Wednesday",
      "status": "PRESENT",
      "clockIn": "10:05",
      "clockOut": "18:10",
      "lateMinutes": 5,
      "compensatedMinutes": 5,
      "effectiveLate": 0,
      "overtimeMinutes": 5,
      "breakMinutes": 60,
      "leaveStart": null,
      "leaveEnd": null,
      "punchSequenceStatus": "VALID",
      "notes": []
    },
    {
      "date": "2026-04-02",
      "status": "ON_LEAVE",
      "leaveType": "إجازة سنوية",
      "isHourlyLeave": false
    }
  ],
  "monthlySummary": {
    "presentDays": 18,
    "absentDays": 1,
    "lateMinutesTotal": 145,
    "compensationTotal": 30,
    "effectiveLate": 115,
    "overtimeMinutes": 90,
    "leaveDays": 2,
    "hourlyLeaves": 4 // ساعات
  }
}
```

### 13.6 Permissions المطلوبة

```typescript
// أضف للـ permissions list
'reports:payroll-summary'
'reports:deduction-breakdown'
'reports:department-attendance'
'reports:lateness-accumulated'
'reports:employee-card'
'reports:employee-card-self'  // الموظف نفسه يرى بطاقته
```

---

## القسم 14: Backfill للبيانات التاريخية

### 14.1 الاستراتيجية

استخدم endpoint backfill الموجود [apps/attendance/src/jobs/backfill.service.ts](apps/attendance/src/jobs/backfill.service.ts):

1. **Dry-run أولاً** على شهر واحد للتحقق من الأرقام.
2. **Apply** بعد التحقق من المحاسب.

### 14.2 Sequence

```bash
# الخطوة 1: dry-run شهر مارس
POST /api/v1/attendance/backfill/dry-run
Body: {
  "fromDate": "2026-03-01",
  "toDate": "2026-03-31",
  "useNewBusinessRules": true   # ← flag جديد
}

# الخطوة 2: مراجعة النتائج

# الخطوة 3: apply
POST /api/v1/attendance/backfill/apply
Body: {
  "fromDate": "2026-03-01",
  "toDate": "2026-03-31",
  "useNewBusinessRules": true,
  "approvedBy": "<userId>"
}
```

### 14.3 تعديل backfill.service.ts

أضف parameter `useNewBusinessRules`:

```typescript
async dryRun(dto: BackfillDryRunDto) {
  const records = await this.getRecordsInRange(dto.fromDate, dto.toDate);
  
  const proposals = [];
  for (const record of records) {
    const newComputation = await this.computationService.recompute(record.id, {
      withMinimumWorkRule: dto.useNewBusinessRules,
      withMonthlyToleranceRule: dto.useNewBusinessRules,
      withFoodAllowanceExclusion: dto.useNewBusinessRules,
      withHourlyLeaveAware: dto.useNewBusinessRules,
    });
    
    if (this.hasDifference(record, newComputation)) {
      proposals.push({
        recordId: record.id,
        before: { /* ... */ },
        after: newComputation,
      });
    }
  }
  
  return { count: proposals.length, sample: proposals.slice(0, 100) };
}
```

### 14.4 ضمانات السلامة

```typescript
// في backfill.service.ts
const PROTECTED_STATUSES = ['ON_LEAVE', 'HOLIDAY', 'WEEKEND'];

// لا تعدل سجلات بهذه الحالات
if (PROTECTED_STATUSES.includes(record.status)) {
  continue;
}

// لا تمسح بيانات raw_attendance_logs أبداً
// كل التعديلات على attendance_records فقط
```

---

## القسم 15: سيناريوهات اختبار القبول

### 15.1 السيناريوهات الأساسية (12 سيناريو)

| # | السيناريو | المتوقع |
|---|-----------|---------|
| 1 | محاسب بصم 10:00 وخرج 13:00 (3 ساعات بالضبط) | PRESENT, lateMinutes=0 |
| 2 | محاسب بصم 10:00, طلع 11:00, رجع 11:30, خرج 13:30 (متواصل أطول = 1.5 ساعة) | HALF_DAY (لأن < 3 ساعات متواصلة) |
| 3 | موظف وردية 10-6 بصم 10:10 (تأخر 10د، ضمن السماحية) | PRESENT, lateMinutes=0 |
| 4 | موظف وردية 10-6 بصم 10:20 وخرج 6:25 (تأخر 20د، عوّض 5د) | lateMinutes=5, lateCompensatedMinutes=5, effectiveLate=0 |
| 5 | موظف تأخر شهرياً 100 دقيقة (أقل من 120) | لا خصم |
| 6 | موظف تأخر شهرياً 150 دقيقة | يُخصم 30 دقيقة فقط |
| 7 | موظف راتبه 5000 + بدلات 1500 شامل 500 طعام، تأخر 60 دقيقة قابلة للخصم | الخصم محسوب من 5000+1000=6000 وليس 6500 |
| 8 | موظف بإجازة ساعية 2-4 (عنده 15 يوم سنوي، وردية 8 ساعات) | يُخصم 0.25 يوم من الرصيد |
| 9 | موظف بإجازة سنوية معتمدة، Daily Closure تشتغل | السجل ON_LEAVE وليس ABSENT |
| 10 | موظف نسي يبصم خروج، بعد 3 أيام HR لم تُغلق | السجل HALF_DAY |
| 11 | موظف نصف يوم AM (10-6 وردية، يحضر 2-6) بصم 2:10 | lateMinutes=10 (محسوبة من 2:00) |
| 12 | موظف جديد بدأ يوم 16 من شهر 30 يوم (15 يوم عمل من 22) | الراتب × (15/22) |

### 15.2 سيناريوهات Edge Cases

| # | السيناريو | المتوقع |
|---|-----------|---------|
| 13 | بصمة وصلت بعد Daily Closure بساعة | السجل يُحدَّث من ABSENT إلى PRESENT تلقائياً |
| 14 | إجازة pending → approved بعد الإغلاق | السجلات للأيام المغطاة تتحول من ABSENT إلى ON_LEAVE |
| 15 | تبرير تأخير 30 دقيقة معتمد | الـ 30 دقيقة لا تُحسب في deductibleLate |
| 16 | تسلسل بصمات: CLOCK_OUT قبل CLOCK_IN | punchSequenceStatus=INVALID + alert |
| 17 | تغيير سياسة الخصم في 15/4 | السجلات قبل 15/4 تستخدم السياسة القديمة |
| 18 | موظف انتقل من وردية 10-6 إلى 9-4 يوم 15/4 | كل يوم يُحسب بوردية ذلك اليوم |

### 15.3 كتابة الاختبارات

`apps/attendance/test/business-rules.spec.ts`:

```typescript
describe('Business Rules - Attendance', () => {
  describe('Accountant continuous work', () => {
    it('should mark PRESENT when worked 3 continuous hours', async () => {
      const punches = [
        { type: 'CLOCK_IN', time: new Date('2026-04-01T10:00:00') },
        { type: 'CLOCK_OUT', time: new Date('2026-04-01T13:00:00') },
      ];
      const result = await service.computeStatus(record, accountantSchedule, punches);
      expect(result.status).toBe('PRESENT');
    });
    
    it('should mark HALF_DAY when continuous work < 3 hours', async () => {
      const punches = [
        { type: 'CLOCK_IN', time: new Date('2026-04-01T10:00:00') },
        { type: 'BREAK_OUT', time: new Date('2026-04-01T11:00:00') }, // 1 ساعة فقط
        { type: 'BREAK_IN', time: new Date('2026-04-01T11:30:00') },
        { type: 'CLOCK_OUT', time: new Date('2026-04-01T13:30:00') }, // 2 ساعة
      ];
      const result = await service.computeStatus(record, accountantSchedule, punches);
      expect(result.status).toBe('HALF_DAY');
    });
  });
  
  describe('Monthly lateness tolerance', () => {
    it('should not deduct when total monthly late <= 120 minutes', async () => {
      const records = createMockRecords({ totalLate: 100, days: 5 });
      const result = await payrollService.computeLatenessDeduction(records, policy);
      expect(result.deductibleMinutes).toBe(0);
    });
    
    it('should deduct only excess beyond 120 minutes', async () => {
      const records = createMockRecords({ totalLate: 180, days: 6 });
      const result = await payrollService.computeLatenessDeduction(records, policy);
      expect(result.deductibleMinutes).toBe(60);
    });
  });
  
  // ... باقي الاختبارات
});
```

---

## القسم 16: ترتيب التنفيذ المُقترح (5 PRs)

### PR #1: Schema Migrations (Day 1-2)

**الهدف:** إضافة كل الأعمدة الجديدة دون أي تأثير على الكود الحالي.

**الملفات:**
- `apps/attendance/prisma/schema.prisma` - إضافات القسم 1.1
- `apps/leave/prisma/schema.prisma` - إضافات القسم 1.2
- `apps/users/prisma/schema.prisma` - تأكيد FOOD enum
- migrations files تلقائية من Prisma

**معيار النجاح:** كل الخدمات تعمل + كل التيستات السابقة تنجح.

### PR #2: Computation Service الموحّد + قواعد الورديات والتأخير (Day 3-7)

**الهدف:** بناء `AttendanceComputationService` المركزي + تطبيق قواعد التأخير الجديدة.

**الملفات:**
- `apps/attendance/src/common/services/attendance-computation.service.ts` (جديد)
- `apps/attendance/src/common/services/continuous-work.service.ts` (جديد)
- `apps/attendance/src/common/services/punch-validator.service.ts` (جديد)
- `apps/attendance/src/jobs/daily-closure.service.ts` (تعديل - leave-aware)
- `apps/attendance/src/payroll/payroll.service.ts` (تعديل - monthly tolerance + compensation)
- seed-shifts.ts (جديد)

**معيار النجاح:** سيناريوهات 1-6, 9, 11, 13 تنجح.

### PR #3: استثناء بدل الطعام + pro-rated salary (Day 8-9)

**الهدف:** الراتب يحسب بـ deductibleBase وليس gross + دعم الموظف الجديد/المنتهي.

**الملفات:**
- `apps/attendance/src/payroll/payroll.service.ts` (تعديل)
- `apps/attendance/src/deduction-policies/deduction-policies.service.ts` (تعديل - excludedAllowanceTypes)
- اختبارات

**معيار النجاح:** سيناريوهات 7, 12 تنجح.

### PR #4: الإجازات الساعية (Day 10-14)

**الهدف:** schema + endpoints + ربط مع الحضور والراتب.

**الملفات:**
- `apps/leave/src/leave-requests/leave-requests.controller.ts` (إضافة hourly endpoint)
- `apps/leave/src/leave-requests/leave-requests.service.ts` (تعديل)
- `apps/leave/src/leave-requests/dto/create-hourly-leave.dto.ts` (جديد)
- `apps/leave/src/leave-balances/leave-balances.service.ts` (تعديل - usedHours)
- `apps/attendance/src/attendance-records/attendance-records.service.ts` (تعديل - applyHourlyLeaveToRecord)
- `apps/attendance/src/common/services/attendance-computation.service.ts` (تعديل - subtract hourlyLeaveMinutes)
- اختبارات

**معيار النجاح:** سيناريوهات 8, 14 تنجح.

### PR #5: التقارير الخمسة + Backfill المُحسَّن (Day 15-20)

**الهدف:** التقارير + إعادة حساب البيانات التاريخية.

**الملفات:**
- `apps/attendance/src/reports/reports.controller.ts` (إضافة 5 endpoints)
- `apps/attendance/src/reports/reports.service.ts` (5 service methods)
- `apps/attendance/src/jobs/backfill.service.ts` (تعديل - useNewBusinessRules flag)
- اختبارات تكاملية لكل تقرير

**معيار النجاح:** كل التقارير تعطي أرقاماً صحيحة + Backfill يُعيد حساب شهر تاريخي.

---

## القسم 17: خارج النطاق (Out of Scope)

ما يلي **ليس** ضمن هذا الملف ويحتاج عمل منفصل:

1. **القروض والسلف ↔ خصم من الراتب** — تكامل `requests-service` مع `payroll`
2. **التأمينات الاجتماعية / الضرائب**
3. **ملفات التحويل البنكي**
4. **مكافآت/علاوات استثنائية لمرة واحدة**
5. **VIP employees (موظفون بقواعد خاصة)**
6. **عقود ساعية / Part-time / Consultant**
7. **مأموريات ON_MISSION** — حالة جديدة لكن منطقها كامل ليس مفصّلاً هنا
8. **الأوفرتايم في العطل بمضاعف** — `holidayMultiplier` مذكور في schema لكن منطق الاحتساب يحتاج توسعة
9. **خطة الإطلاق والتشغيل الموازي**
10. **مراجعة محاسبية للنتائج**

---

## القسم 18: ملاحظات مهمة للمبرمج

### 18.1 الترتيب الصارم
نفّذ الـ PRs بالترتيب أعلاه. كل PR يبني على الذي قبله. لا تخلط.

### 18.2 الاختبارات
- لا تدمج PR بدون اختبارات وحدة على المنطق الجديد.
- استخدم بيانات seed الجديدة (`seed-shifts.ts`) في الاختبارات.

### 18.3 الـ Migrations
- كل migration **additive only** — لا `ALTER COLUMN`، لا `DROP COLUMN`.
- اختبر migration على نسخة من البيانات الحقيقية قبل الإنتاج.

### 18.4 الـ Audit Trail
- كل تعديل تلقائي على `attendance_records` (من backfill، إجازة معتمدة، تبرير، ...) يجب أن يُكتب في `AttendanceComputationLog`.

### 18.5 الـ Backfill
- لا تشغّل `apply` mode في الإنتاج بدون موافقة المحاسب على dry-run أولاً.
- شغّل على شهر واحد كحد أقصى في كل مرة.

### 18.6 Performance
- التقارير الشاملة قد تكون بطيئة على الأقسام الكبيرة. أضف indexes:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_records_emp_date ON attendance.attendance_records(employee_id, date);
  CREATE INDEX IF NOT EXISTS idx_records_dept_date ON attendance.attendance_records(department_id, date);
  ```

### 18.7 الـ TimeZone
كل الـ `Date` فيه يُفترض أن يكون UTC في DB، لكن الحسابات (Daily Closure، parsing الـ HH:mm) تستخدم Riyadh TZ (UTC+3). تأكد من:
```typescript
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
const TZ = 'Asia/Riyadh';
```

### 18.8 الأسئلة المفتوحة (اسأل قبل التنفيذ)
1. ما هو `workDays` للشركة؟ [0,1,2,3,4] (الأحد للخميس) أم [1,2,3,4,5] (الإثنين للجمعة)؟
2. هل `MISSING_CLOCK_OUT` بعد 48 ساعة = نصف يوم، أم سياسة مختلفة؟
3. كم مرة تُحدَّث سياسة الخصم سنوياً؟ (يحدد حاجة versioning عميق)
4. هل التبرير المعتمد يلغي **كل** التأخير لذلك اليوم، أم بمقدار محدد فقط؟

---

## نهاية الملف

**عدد الأقسام:** 18
**عدد التغييرات على Schema:** 14 عمود + 2 enum + 1 جدول جديد
**عدد Endpoints الجديدة:** 6 (1 hourly leave + 5 reports)
**عدد الخدمات الجديدة:** 3 (computation, continuous-work, punch-validator)
**ملفات يجب لمسها:** ~15 ملف
**عدد PRs المقترحة:** 5
**الجهد التقني المقدّر:** 20 يوم عمل

في حال أي غموض، راجع الأقسام ذات الصلة أو افتح نقاش مع صاحب المشروع.
