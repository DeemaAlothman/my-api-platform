import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DailyClosureService implements OnModuleInit {
  private readonly logger = new Logger(DailyClosureService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.scheduleNextRun();
    this.scheduleNextTardinessReminder();
  }

  /** Phase 0.7.3: تذكير الموظفين بتأخير غير معوَّض الساعة 4 ظ دمشق (13:00 UTC) */
  private scheduleNextTardinessReminder() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(13, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    const delayMs = next.getTime() - now.getTime();
    this.logger.log(`Tardiness reminder scheduled in ${Math.round(delayMs / 60000)} minutes (at ${next.toISOString()})`);

    setTimeout(async () => {
      const dateStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
      try {
        await this.remindUncompensatedTardiness(dateStr);
      } catch (err) {
        this.logger.error(`Tardiness reminder failed: ${(err as any)?.message}`);
      }
      this.scheduleNextTardinessReminder();
    }, delayMs);
  }

  private async remindUncompensatedTardiness(dateStr: string): Promise<void> {
    try {
      const records = (await this.prisma.$queryRawUnsafe(
        `SELECT ar."employeeId", ar."lateMinutes", e."userId"
         FROM attendance.attendance_records ar
         JOIN users.employees e ON e.id = ar."employeeId"
         WHERE ar.date = $1::date
           AND ar."lateMinutes" > 0
           AND ar."lateCompensatedMinutes" = 0
           AND ar."clockOutTime" IS NULL
           AND ar.status NOT IN ('ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'PARTIAL_LEAVE', 'HALF_DAY')
           AND e."userId" IS NOT NULL
           AND e."deletedAt" IS NULL`,
        dateStr,
      )) as Array<{ employeeId: string; lateMinutes: number; userId: string }>;

      this.logger.log(`Tardiness reminder: ${records.length} employee(s) with uncompensated tardiness on ${dateStr}`);

      for (const r of records) {
        try {
          await this.prisma.$queryRawUnsafe(
            `INSERT INTO users.notifications
               (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
             VALUES
               (gen_random_uuid(), $1, 'TARDINESS_COMPENSATION_DUE',
                'تذكير: تأخير غير معوَّض', 'Reminder: Uncompensated Tardiness',
                $2, $3, false, NOW())`,
            r.userId,
            `لديك تأخير ${r.lateMinutes} دقيقة غير معوَّض اليوم — لتعويضه البق بعد نهاية الدوام بنفس المدة`,
            `You have ${r.lateMinutes} uncompensated late minutes today — stay ${r.lateMinutes} min past your shift end to compensate`,
          );
        } catch {
          // إشعار فاشل لا يوقف العملية
        }
      }
    } catch (err) {
      this.logger.error(`remindUncompensatedTardiness failed: ${(err as any)?.message}`);
    }
  }

  private scheduleNextRun() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(21, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    const delayMs = next.getTime() - now.getTime();
    this.logger.log(`Daily closure scheduled in ${Math.round(delayMs / 60000)} minutes (at ${next.toISOString()})`);

    setTimeout(async () => {
      const dateStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
      this.logger.log(`Daily closure running for date: ${dateStr}`);
      try {
        const result = await this.processDayForAllEmployees(dateStr);
        this.logger.log(`Daily closure done: ${JSON.stringify(result)}`);
      } catch (err) {
        this.logger.error(`Daily closure failed: ${(err as any)?.message}`);
      }
      this.scheduleNextRun();
    }, delayMs);
  }

  async processDayForAllEmployees(dateStr: string): Promise<{
    date: string;
    absentCreated: number;
    missingClockOutAlerts: number;
    onLeaveApplied: number;
    holidayApplied: number;
    orphanNotified: number;
    skipped: number;
  }> {
    const date = new Date(dateStr + 'T00:00:00Z');
    const dayOfWeek = date.getUTCDay();

    // C.1: JOIN users.employees to filter out INACTIVE/TERMINATED employees
    const scheduledEmployees = (await this.prisma.$queryRawUnsafe(
      `SELECT es."employeeId", ws."workDays"
       FROM attendance.employee_schedules es
       JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
       JOIN users.employees e ON e.id = es."employeeId"
       WHERE es."isActive" = true
         AND e."employmentStatus" = 'ACTIVE'
         AND e."deletedAt" IS NULL
         AND $1::date BETWEEN es."effectiveFrom"::date
             AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)`,
      dateStr,
    )) as Array<{ employeeId: string; workDays: string }>;

    const workingEmployeeIds = scheduledEmployees
      .filter(emp => {
        try {
          return (JSON.parse(emp.workDays) as number[]).includes(dayOfWeek);
        } catch { return false; }
      })
      .map(emp => emp.employeeId);

    if (workingEmployeeIds.length === 0) {
      return { date: dateStr, absentCreated: 0, missingClockOutAlerts: 0, onLeaveApplied: 0, holidayApplied: 0, orphanNotified: 0, skipped: 0 };
    }

    // C.2: Check if today is an official holiday before processing absences
    const holiday = await this.getHolidayForDate(dateStr);

    if (holiday) {
      let holidayApplied = 0;
      for (const employeeId of workingEmployeeIds) {
        await this.upsertHolidayRecord(employeeId, dateStr, holiday.nameAr);
        holidayApplied++;
      }
      this.logger.log(`Holiday detected (${holiday.nameAr}) for ${dateStr}: ${holidayApplied} records set to HOLIDAY`);
      // C.3: Still check for orphans even on holidays
      const orphanNotified = await this.checkAndNotifyOrphans(dateStr);
      return { date: dateStr, absentCreated: 0, missingClockOutAlerts: 0, onLeaveApplied: 0, holidayApplied, orphanNotified, skipped: 0 };
    }

    const existingRecords = (await this.prisma.$queryRawUnsafe(
      `SELECT "employeeId", "clockInTime", "clockOutTime", status
       FROM attendance.attendance_records
       WHERE date = $1::date AND "employeeId" = ANY($2::text[])`,
      dateStr,
      workingEmployeeIds,
    )) as Array<{ employeeId: string; clockInTime: Date | null; clockOutTime: Date | null; status: string }>;

    const recordMap = new Map(existingRecords.map(r => [r.employeeId, r]));

    // فحص الإجازات المعتمدة لهذا اليوم
    const approvedLeaves = await this.getApprovedLeavesForDate(workingEmployeeIds, dateStr);
    const leaveMap = new Map(approvedLeaves.map(l => [l.employeeId, l]));

    // Fetch salaryLinked config for all working employees at once
    const configRows = (await this.prisma.$queryRawUnsafe(
      `SELECT "employeeId", "salaryLinked"
       FROM attendance.employee_attendance_configs
       WHERE "employeeId" = ANY($1::text[])`,
      workingEmployeeIds,
    )) as Array<{ employeeId: string; salaryLinked: boolean }>;
    const salaryLinkedMap = new Map(configRows.map(r => [r.employeeId, r.salaryLinked]));

    let absentCreated = 0;
    let missingClockOutAlerts = 0;
    let onLeaveApplied = 0;
    let skipped = 0;

    for (const employeeId of workingEmployeeIds) {
      const record = recordMap.get(employeeId);
      const salaryLinked = salaryLinkedMap.get(employeeId) ?? true;

      // موظف عنده إجازة معتمدة → ON_LEAVE أو PARTIAL_LEAVE
      const leave = leaveMap.get(employeeId);
      if (leave) {
        await this.upsertLeaveRecord(employeeId, dateStr, leave);
        onLeaveApplied++;
        continue;
      }

      // غير مرتبط بالراتب (معفي من الحضور) → لا يُعلَّم غائباً ولا تُنشأ له سجلات حضور تلقائية
      if (!salaryLinked) {
        skipped++;
        continue;
      }

      if (!record) {
        await this.createAbsentRecord(employeeId, dateStr, salaryLinked);
        absentCreated++;
      } else if (['ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'ABSENT'].includes(record.status)) {
        skipped++;
      } else if (record.clockInTime && !record.clockOutTime) {
        await this.createMissingClockOutAlert(employeeId, dateStr, salaryLinked);
        missingClockOutAlerts++;
      } else {
        skipped++;
      }
    }

    // C.3: Notify HR about active employees with no schedule assigned
    const orphanNotified = await this.checkAndNotifyOrphans(dateStr);

    // C.4: Process tardiness offsets from hourly leave balance
    await this.processTardinessOffsets(dateStr);

    // C.5: Flag employees who exceeded allowed break time
    await this.processBreakOverLimit(dateStr);

    // C.6: Detect anomalous attendance patterns
    await this.processAnomalyDetection(dateStr);

    // C.7: Compute overtime from approved requests (replaces auto-calculated overtime)
    await this.processOvertimeFromRequests(dateStr);

    return { date: dateStr, absentCreated, missingClockOutAlerts, onLeaveApplied, holidayApplied: 0, orphanNotified, skipped };
  }

  // C.2: Returns holiday info if the given date is a holiday (exact date or recurring by month/day)
  private async getHolidayForDate(dateStr: string): Promise<{ nameAr: string } | null> {
    try {
      const date = new Date(dateStr + 'T00:00:00Z');
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();

      const rows = await this.prisma.$queryRawUnsafe(
        `SELECT "nameAr" FROM leaves.holidays
         WHERE $1::date BETWEEN date::date AND COALESCE("endDate"::date, date::date)
            OR ("isRecurring" = true
                AND EXTRACT(MONTH FROM date) = $2
                AND EXTRACT(DAY FROM date) = $3)
         LIMIT 1`,
        dateStr, month, day,
      );
      return (rows as any[])[0] || null;
    } catch {
      return null;
    }
  }

  // C.2: Upsert HOLIDAY record — does not override existing clock-in records
  private async upsertHolidayRecord(employeeId: string, dateStr: string, holidayName: string) {
    try {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO attendance.attendance_records
           (id, "employeeId", date, status, source, "isManualEntry",
            "lateMinutes", "earlyLeaveMinutes", "deductionApplied",
            "salaryLinked", notes, "createdAt", "updatedAt")
         VALUES
           (gen_random_uuid(), $1, $2::date, 'HOLIDAY', 'SYSTEM', false,
            0, 0, false, true, $3, NOW(), NOW())
         ON CONFLICT ("employeeId", date) DO UPDATE SET
           status = CASE
             WHEN attendance_records."clockInTime" IS NOT NULL
                  THEN attendance_records.status
             ELSE 'HOLIDAY'
           END,
           notes = COALESCE(attendance_records.notes, EXCLUDED.notes),
           "updatedAt" = NOW()`,
        employeeId, dateStr, `عطلة رسمية: ${holidayName}`,
      );
    } catch (err) {
      this.logger.error(`Failed to upsert HOLIDAY record for ${employeeId} on ${dateStr}: ${(err as any)?.message}`);
    }
  }

  // C.3: Query active employees with no active schedule and notify HR
  private async checkAndNotifyOrphans(dateStr: string): Promise<number> {
    try {
      const orphans = (await this.prisma.$queryRawUnsafe(
        `SELECT e.id, e."firstNameAr", e."lastNameAr", e."employeeNumber"
         FROM users.employees e
         WHERE e."employmentStatus" = 'ACTIVE'
           AND e."deletedAt" IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM attendance.employee_schedules es
             WHERE es."employeeId" = e.id
               AND (es."isActive" = true OR (es."isActive" = false AND es."effectiveTo" IS NOT NULL))
               AND $1::date BETWEEN es."effectiveFrom"::date
                   AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)
           )`,
        dateStr,
      )) as Array<{ id: string; firstNameAr: string; lastNameAr: string; employeeNumber: string }>;

      if (orphans.length === 0) return 0;

      await this.notifyHRAboutOrphans(orphans, dateStr);
      return orphans.length;
    } catch (err) {
      this.logger.error(`Orphan check failed for ${dateStr}: ${(err as any)?.message}`);
      return 0;
    }
  }

  private async notifyHRAboutOrphans(
    orphans: Array<{ id: string; firstNameAr: string; lastNameAr: string; employeeNumber: string }>,
    dateStr: string,
  ) {
    try {
      const hrUsers = (await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT u.id
         FROM users.users u
         INNER JOIN users.user_roles ur ON ur."userId" = u.id
         INNER JOIN users.roles r ON r.id = ur."roleId"
         WHERE r.name IN ('HR', 'HR_Specialist', 'super_admin')
           AND r."deletedAt" IS NULL
           AND u."deletedAt" IS NULL`,
      )) as Array<{ id: string }>;

      if (hrUsers.length === 0) return;

      const names = orphans.map(e => `${e.firstNameAr} ${e.lastNameAr} (${e.employeeNumber})`).join('، ');

      for (const hr of hrUsers) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications
             (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
           VALUES
             (gen_random_uuid(), $1, 'GENERAL',
              'موظفون بدون جدول دوام',
              'Employees Without Schedule',
              $2, $3,
              false, NOW())`,
          hr.id,
          `يوم ${dateStr}: ${orphans.length} موظف نشط بدون جدول دوام: ${names}`,
          `Date ${dateStr}: ${orphans.length} active employee(s) with no assigned schedule: ${names}`,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to send orphan notifications: ${(err as any)?.message}`);
    }
  }

  private async getApprovedLeavesForDate(
    employeeIds: string[],
    dateStr: string,
  ): Promise<Array<{
    employeeId: string;
    isHourlyLeave: boolean;
    startTime: string | null;
    endTime: string | null;
    durationHours: number | null;
  }>> {
    if (employeeIds.length === 0) return [];
    try {
      return (await this.prisma.$queryRawUnsafe(
        `SELECT "employeeId", "isHourlyLeave", "startTime", "endTime", "durationHours"
         FROM leaves.leave_requests
         WHERE "employeeId" = ANY($1::text[])
           AND "startDate"::date <= $2::date
           AND "endDate"::date >= $2::date
           AND status = 'APPROVED'
           AND "deletedAt" IS NULL
         ORDER BY "createdAt" DESC`,
        employeeIds,
        dateStr,
      )) as Array<{
        employeeId: string;
        isHourlyLeave: boolean;
        startTime: string | null;
        endTime: string | null;
        durationHours: number | null;
      }>;
    } catch (err) {
      this.logger.error(`Failed to fetch approved leaves: ${(err as any)?.message}`);
      return [];
    }
  }

  private async upsertLeaveRecord(
    employeeId: string,
    dateStr: string,
    leave: { isHourlyLeave: boolean; startTime: string | null; endTime: string | null; durationHours: number | null },
  ) {
    try {
      const status = leave.isHourlyLeave ? 'PARTIAL_LEAVE' : 'ON_LEAVE';
      const hourlyLeaveMinutes = leave.durationHours ? Math.floor(leave.durationHours * 60) : 0;
      const leaveStartTs = leave.startTime ? new Date(`${dateStr}T${leave.startTime}:00`) : null;
      const leaveEndTs = leave.endTime ? new Date(`${dateStr}T${leave.endTime}:00`) : null;

      await this.prisma.$queryRawUnsafe(
        `INSERT INTO attendance.attendance_records
           (id, "employeeId", date, status, source, "isManualEntry",
            "lateMinutes", "earlyLeaveMinutes", "deductionApplied",
            "hourlyLeaveMinutes", "leaveStartTime", "leaveEndTime",
            "salaryLinked", "createdAt", "updatedAt")
         VALUES
           (gen_random_uuid(), $1, $2::date, $3, 'SYSTEM', false,
            0, 0, false, $4, $5, $6, false, NOW(), NOW())
         ON CONFLICT ("employeeId", date) DO UPDATE SET
           status = CASE
             WHEN attendance_records."clockInTime" IS NOT NULL THEN 'PARTIAL_LEAVE'
             ELSE EXCLUDED.status
           END,
           "leaveStartTime"      = EXCLUDED."leaveStartTime",
           "leaveEndTime"        = EXCLUDED."leaveEndTime",
           "hourlyLeaveMinutes"  = EXCLUDED."hourlyLeaveMinutes",
           "updatedAt"           = NOW()`,
        employeeId, dateStr, status, hourlyLeaveMinutes, leaveStartTs, leaveEndTs,
      );

      await this.auditLog(null, employeeId, dateStr, 'LEAVE_APPLIED', 'DAILY_CLOSURE',
        `سجل إجازة ${leave.isHourlyLeave ? 'ساعية' : 'كاملة'} تم تطبيقه تلقائياً`);
    } catch (err) {
      this.logger.error(`Failed to upsert leave record for ${employeeId} on ${dateStr}: ${(err as any)?.message}`);
    }
  }

  private async createAbsentRecord(employeeId: string, dateStr: string, salaryLinked = true) {
    try {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO attendance.attendance_records
           (id, "employeeId", date, status, source,
            "isManualEntry", "lateMinutes", "earlyLeaveMinutes", "deductionApplied",
            "createdAt", "updatedAt")
         VALUES
           (gen_random_uuid(), $1, $2::date, 'ABSENT', 'SYSTEM',
            false, 0, 0, false, NOW(), NOW())
         ON CONFLICT ("employeeId", date) DO NOTHING`,
        employeeId, dateStr,
      );

      // Only create alert if attendance is linked to salary
      if (salaryLinked) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO attendance.attendance_alerts
             (id, "employeeId", date, "alertType", severity, message, "messageAr",
              status, "isAutoGenerated", "createdAt", "updatedAt")
           VALUES
             (gen_random_uuid(), $1, $2::date, 'ABSENT', 'HIGH', $3, $4,
              'OPEN', true, NOW(), NOW())`,
          employeeId, dateStr,
          `Employee was absent on ${dateStr}`,
          `الموظف غائب يوم ${dateStr}`,
        );
      }

      await this.auditLog(null, employeeId, dateStr, 'ABSENT_CREATED', 'DAILY_CLOSURE',
        `تم إنشاء سجل غياب تلقائي ليوم ${dateStr}`);
    } catch (err) {
      this.logger.error(`Failed to create ABSENT for ${employeeId} on ${dateStr}: ${(err as any)?.message}`);
    }
  }

  private async createMissingClockOutAlert(employeeId: string, dateStr: string, salaryLinked = true) {
    if (!salaryLinked) return; // exempt employees don't get alerts

    try {
      const existing = (await this.prisma.$queryRawUnsafe(
        `SELECT id FROM attendance.attendance_alerts
         WHERE "employeeId" = $1 AND date = $2::date AND "alertType" = 'MISSING_CLOCK_OUT'
         LIMIT 1`,
        employeeId, dateStr,
      )) as Array<{ id: string }>;

      if (existing.length > 0) return;

      await this.prisma.$queryRawUnsafe(
        `INSERT INTO attendance.attendance_alerts
           (id, "employeeId", date, "alertType", severity, message, "messageAr",
            status, "isAutoGenerated", "createdAt", "updatedAt")
         VALUES
           (gen_random_uuid(), $1, $2::date, 'MISSING_CLOCK_OUT', 'MEDIUM', $3, $4,
            'OPEN', true, NOW(), NOW())`,
        employeeId, dateStr,
        `Employee did not clock out on ${dateStr}`,
        `الموظف لم يسجل خروجاً يوم ${dateStr}`,
      );

      await this.auditLog(null, employeeId, dateStr, 'MISSING_CLOCK_OUT_ALERT', 'DAILY_CLOSURE',
        `تم إنشاء تنبيه خروج مفقود ليوم ${dateStr}`);
    } catch (err) {
      this.logger.error(`Failed to create MISSING_CLOCK_OUT for ${employeeId} on ${dateStr}: ${(err as any)?.message}`);
    }
  }

  /**
   * بعد إغلاق اليوم: لكل موظف عنده تأخير غير معوَّض → اخصم من رصيد HOURLY_PAID
   * إذا تجاوز الرصيد → سجّل "tardinessPendingDeductionMinutes" للحسم من الراتب
   */
  private async processTardinessOffsets(dateStr: string): Promise<void> {
    try {
      const records = (await this.prisma.$queryRawUnsafe(
        `SELECT id, "employeeId", "lateMinutes", "lateCompensatedMinutes"
         FROM attendance.attendance_records
         WHERE date = $1::date
           AND "lateMinutes" > "lateCompensatedMinutes"
           AND status NOT IN ('ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'PARTIAL_LEAVE', 'ABSENT')`,
        dateStr,
      )) as Array<{ id: string; employeeId: string; lateMinutes: number; lateCompensatedMinutes: number }>;

      if (records.length === 0) return;

      const hourlyTypes = (await this.prisma.$queryRawUnsafe(
        `SELECT id, "maxHoursPerMonth" FROM leaves.leave_types
         WHERE code = 'HOURLY' AND "isActive" = true LIMIT 1`,
      )) as Array<{ id: string; maxHoursPerMonth: number }>;

      if (!hourlyTypes[0]) {
        this.logger.warn('processTardinessOffsets: HOURLY leave type not found — skipping');
        return;
      }

      const leaveTypeId = hourlyTypes[0].id;
      const maxMonthlyMinutes = (hourlyTypes[0].maxHoursPerMonth ?? 2) * 60;
      const year = new Date(dateStr).getFullYear();

      const monthStart = new Date(dateStr);
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      for (const record of records) {
        try {
          const uncompensated = record.lateMinutes - record.lateCompensatedMinutes;
          if (uncompensated <= 0) continue;

          const usedRows = (await this.prisma.$queryRawUnsafe(
            `SELECT COALESCE(SUM("durationHours" * 60), 0)::int AS used
             FROM leaves.leave_requests
             WHERE "employeeId" = $1
               AND "isHourlyLeave" = true
               AND status = 'APPROVED'
               AND "startDate" >= $2
               AND "leaveTypeId" = $3
               AND "deletedAt" IS NULL`,
            record.employeeId, monthStart, leaveTypeId,
          )) as Array<{ used: number }>;

          const usedMinutes = usedRows[0]?.used ?? 0;
          const remainingBalance = Math.max(0, maxMonthlyMinutes - usedMinutes);

          if (remainingBalance > 0) {
            const toConsume = Math.min(uncompensated, remainingBalance);
            const durationHours = toConsume / 60;

            await this.prisma.$queryRawUnsafe(
              `INSERT INTO leaves.leave_requests
                 (id, "employeeId", "leaveTypeId", "startDate", "endDate", "totalDays",
                  "isHourlyLeave", "durationHours", status, reason, source, "isAutoGenerated",
                  "createdAt", "updatedAt")
               VALUES
                 (gen_random_uuid(), $1, $2, $3::date, $3::date, 0,
                  true, $4, 'APPROVED', $5, 'TARDINESS_AUTO', true, NOW(), NOW())`,
              record.employeeId, leaveTypeId, dateStr, durationHours,
              `تعويض تأخير ${toConsume} دقيقة بتاريخ ${dateStr}`,
            );

            await this.prisma.$queryRawUnsafe(
              `UPDATE leaves.leave_balances
               SET "usedHours" = "usedHours" + $1, "updatedAt" = NOW()
               WHERE "employeeId" = $2 AND "leaveTypeId" = $3 AND year = $4`,
              durationHours, record.employeeId, leaveTypeId, year,
            );

            await this.prisma.$queryRawUnsafe(
              `UPDATE attendance.attendance_records
               SET "tardinessOffsetMinutes" = $1, "updatedAt" = NOW()
               WHERE id = $2`,
              toConsume, record.id,
            );

            await this.sendTardinessNotification(record.employeeId, 'TARDINESS_BALANCE_USED',
              `خُصم ${toConsume} دقيقة من رصيد إجازتك الساعية بسبب تأخير اليوم`,
              `Deducted ${toConsume} min from your hourly leave balance for today's tardiness`,
            );

            const newRemaining = remainingBalance - toConsume;
            if (newRemaining === 0) {
              await this.sendTardinessNotification(record.employeeId, 'TARDINESS_BALANCE_DEPLETED',
                'استنفدت رصيدك الشهري — أي تأخير قادم سيُحسم من راتبك',
                'Monthly balance depleted — future tardiness will be deducted from salary',
              );
              await this.notifyManager(record.employeeId, 'TARDINESS_BALANCE_DEPLETED',
                'استنفاد رصيد الإجازة الساعية',
                'Hourly Leave Balance Depleted',
              );
            } else if (newRemaining <= 30) {
              await this.sendTardinessNotification(record.employeeId, 'TARDINESS_BALANCE_LOW',
                `رصيدك الشهري قارب على النفاد (${newRemaining} دقيقة متبقية)`,
                `Your monthly balance is low (${newRemaining} min remaining)`,
              );
              await this.notifyManager(record.employeeId, 'TARDINESS_BALANCE_LOW',
                'رصيد الإجازة الساعية منخفض',
                'Hourly Leave Balance Low',
              );
            }
          }

          const pendingDeduction = Math.max(0, uncompensated - remainingBalance);
          if (pendingDeduction > 0) {
            await this.prisma.$queryRawUnsafe(
              `UPDATE attendance.attendance_records
               SET "tardinessPendingDeductionMinutes" = $1, "updatedAt" = NOW()
               WHERE id = $2`,
              pendingDeduction, record.id,
            );

            await this.sendTardinessNotification(record.employeeId, 'TARDINESS_DEDUCTION_PENDING',
              `سيُحسم ${pendingDeduction} دقيقة من راتبك نهاية الشهر`,
              `${pendingDeduction} min will be deducted from your salary at month-end`,
            );
          }
        } catch (err) {
          this.logger.error(
            `processTardinessOffsets failed for employee ${record.employeeId} on ${dateStr}: ${(err as any)?.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`processTardinessOffsets failed for ${dateStr}: ${(err as any)?.message}`);
    }
  }

  private async sendTardinessNotification(
    employeeId: string,
    type: string,
    messageAr: string,
    messageEn: string,
  ): Promise<void> {
    try {
      const userRow = (await this.prisma.$queryRawUnsafe(
        `SELECT "userId" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
        employeeId,
      )) as Array<{ userId: string | null }>;

      const userId = userRow[0]?.userId;
      if (!userId) return;

      await this.prisma.$queryRawUnsafe(
        `INSERT INTO users.notifications
           (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW())`,
        userId, type,
        messageAr, messageEn,
        messageAr, messageEn,
      );
    } catch {
      // إشعار فاشل لا يوقف العملية
    }
  }

  private async notifyManager(
    employeeId: string,
    type: string,
    titleAr: string,
    titleEn: string,
  ): Promise<void> {
    try {
      const managerRow = (await this.prisma.$queryRawUnsafe(
        `SELECT e."firstNameAr", e."lastNameAr", m."userId" as "managerUserId"
         FROM users.employees e
         JOIN users.employees m ON m.id = e."managerId"
         WHERE e.id = $1 AND e."deletedAt" IS NULL AND m."deletedAt" IS NULL LIMIT 1`,
        employeeId,
      )) as Array<{ firstNameAr: string; lastNameAr: string; managerUserId: string }>;

      if (!managerRow[0]?.managerUserId) return;

      const empName = `${managerRow[0].firstNameAr} ${managerRow[0].lastNameAr}`;

      await this.prisma.$queryRawUnsafe(
        `INSERT INTO users.notifications
           (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW())`,
        managerRow[0].managerUserId, type,
        titleAr, titleEn,
        `${titleAr} — ${empName}`,
        `${titleEn} — ${empName}`,
      );
    } catch {
      // إشعار فاشل لا يوقف العملية
    }
  }

  /** Phase 4.2: تحديد تجاوز وقت الاستراحة المسموح به
   * يطرح تقاطع الاستراحات مع (الإجازة الساعية + نصف اليوم) قبل مقارنتها بالحد المسموح
   */
  private async processBreakOverLimit(dateStr: string): Promise<void> {
    try {
      const records = (await this.prisma.$queryRawUnsafe(
        `WITH break_stats AS (
           SELECT ar.id, ar."employeeId", ar."totalBreakMinutes", ws."allowedBreakMinutes",
                  -- تقاطع مع الإجازة الساعية الصريحة
                  COALESCE(SUM(
                    GREATEST(0, EXTRACT(EPOCH FROM (
                      LEAST(ab."breakIn", ar."leaveEndTime") -
                      GREATEST(ab."breakOut", ar."leaveStartTime")
                    )) / 60)::int
                  ) FILTER (
                    WHERE ab.id IS NOT NULL
                      AND ar."leaveStartTime" IS NOT NULL AND ar."leaveEndTime" IS NOT NULL
                      AND ab."breakIn" IS NOT NULL
                  ), 0)::int AS "leaveOverlap",
                  -- تقاطع مع فترة نصف اليوم (AM → الصباح معذور، PM → المساء معذور)
                  COALESCE(SUM(
                    GREATEST(0, EXTRACT(EPOCH FROM (
                      LEAST(ab."breakIn",
                        CASE
                          WHEN ar."halfDayPeriod" = 'AM' THEN
                            (ar.date::date)::timestamp + make_interval(mins =>
                              (SPLIT_PART(ws."workStartTime",':',1)::int*60 + SPLIT_PART(ws."workStartTime",':',2)::int +
                               SPLIT_PART(ws."workEndTime",':',1)::int*60   + SPLIT_PART(ws."workEndTime",':',2)::int
                              ) / 2 - 180)
                          WHEN ar."halfDayPeriod" = 'PM' THEN
                            (ar.date::date)::timestamp + make_interval(mins =>
                               SPLIT_PART(ws."workEndTime",':',1)::int*60 + SPLIT_PART(ws."workEndTime",':',2)::int - 180)
                          ELSE NULL
                        END
                      ) -
                      GREATEST(ab."breakOut",
                        CASE
                          WHEN ar."halfDayPeriod" = 'AM' THEN
                            (ar.date::date)::timestamp + make_interval(mins =>
                               SPLIT_PART(ws."workStartTime",':',1)::int*60 + SPLIT_PART(ws."workStartTime",':',2)::int - 180)
                          WHEN ar."halfDayPeriod" = 'PM' THEN
                            (ar.date::date)::timestamp + make_interval(mins =>
                              (SPLIT_PART(ws."workStartTime",':',1)::int*60 + SPLIT_PART(ws."workStartTime",':',2)::int +
                               SPLIT_PART(ws."workEndTime",':',1)::int*60   + SPLIT_PART(ws."workEndTime",':',2)::int
                              ) / 2 - 180)
                          ELSE NULL
                        END
                      )
                    )) / 60)::int
                  ) FILTER (
                    WHERE ab.id IS NOT NULL AND ar."halfDayPeriod" IS NOT NULL
                      AND ws."workStartTime" IS NOT NULL AND ws."workEndTime" IS NOT NULL
                      AND ab."breakIn" IS NOT NULL
                  ), 0)::int AS "halfDayOverlap"
           FROM attendance.attendance_records ar
           JOIN attendance.employee_schedules es
             ON es."employeeId" = ar."employeeId"
             AND $1::date BETWEEN es."effectiveFrom"::date
                 AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)
             AND es."isActive" = true
           JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
           LEFT JOIN attendance.attendance_breaks ab ON ab."attendanceRecordId" = ar.id
           WHERE ar.date = $1::date
             AND ar.status NOT IN ('ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'PARTIAL_LEAVE', 'ABSENT')
           GROUP BY ar.id, ar."employeeId", ar."totalBreakMinutes", ws."allowedBreakMinutes",
                    ar."leaveStartTime", ar."leaveEndTime", ar."halfDayPeriod",
                    ws."workStartTime", ws."workEndTime"
         )
         SELECT id, "employeeId", "totalBreakMinutes", "allowedBreakMinutes",
                ("leaveOverlap" + "halfDayOverlap") AS "leaveBreakOverlapMinutes"
         FROM break_stats
         WHERE ("totalBreakMinutes" - ("leaveOverlap" + "halfDayOverlap")) > "allowedBreakMinutes"`,
        dateStr,
      )) as Array<{
        id: string; employeeId: string;
        totalBreakMinutes: number; allowedBreakMinutes: number;
        leaveBreakOverlapMinutes: number;
      }>;

      for (const record of records) {
        const effectiveBreak = record.totalBreakMinutes - record.leaveBreakOverlapMinutes;
        const overMinutes = effectiveBreak - record.allowedBreakMinutes;
        try {
          await this.prisma.$queryRawUnsafe(
            `UPDATE attendance.attendance_records
             SET "breakOverLimitMinutes" = $1, "updatedAt" = NOW()
             WHERE id = $2`,
            overMinutes, record.id,
          );

          // تنبيه BREAK_GAP في attendance_alerts (مرة واحدة باليوم)
          await this.prisma.$queryRawUnsafe(
            `INSERT INTO attendance.attendance_alerts
               (id, "employeeId", date, "alertType", severity, message, "messageAr",
                status, "isAutoGenerated", "createdAt", "updatedAt")
             SELECT gen_random_uuid(), $1, $2::date, 'BREAK_GAP',
               CASE WHEN $3::int > 30 THEN 'HIGH' ELSE 'MEDIUM' END,
               $4, $5, 'OPEN', true, NOW(), NOW()
             WHERE NOT EXISTS (
               SELECT 1 FROM attendance.attendance_alerts
               WHERE "employeeId" = $1 AND date = $2::date AND "alertType" = 'BREAK_GAP'
             )`,
            record.employeeId, dateStr, overMinutes,
            `Break over limit by ${overMinutes} minutes on ${dateStr}`,
            `تجاوز وقت الاستراحة بـ ${overMinutes} دقيقة يوم ${dateStr}`,
          );

          // إشعار الموظف
          await this.sendTardinessNotification(
            record.employeeId, 'BREAK_EXCEEDED',
            `تجاوزت وقت الاستراحة المسموح به بـ ${overMinutes} دقيقة اليوم`,
            `You exceeded the allowed break time by ${overMinutes} minutes today`,
          );

          // إشعار المدير المباشر
          await this.notifyManager(record.employeeId, 'BREAK_EXCEEDED',
            'تجاوز وقت الاستراحة', 'Break Over Limit',
          );

          // إشعار HR
          await this.notifyHRBreakGap(record.employeeId, dateStr, overMinutes);

        } catch (err) {
          this.logger.error(`processBreakOverLimit failed for ${record.employeeId}: ${(err as any)?.message}`);
        }
      }
    } catch (err) {
      this.logger.error(`processBreakOverLimit failed for ${dateStr}: ${(err as any)?.message}`);
    }
  }

  private async notifyHRBreakGap(employeeId: string, dateStr: string, overMinutes: number): Promise<void> {
    try {
      const empRow = (await this.prisma.$queryRawUnsafe(
        `SELECT e."firstNameAr", e."lastNameAr"
         FROM users.employees e WHERE e.id = $1 AND e."deletedAt" IS NULL LIMIT 1`,
        employeeId,
      )) as Array<{ firstNameAr: string; lastNameAr: string }>;
      if (!empRow[0]) return;
      const empName = `${empRow[0].firstNameAr} ${empRow[0].lastNameAr}`;

      const hrUsers = (await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT u.id
         FROM users.users u
         INNER JOIN users.user_roles ur ON ur."userId" = u.id
         INNER JOIN users.roles r ON r.id = ur."roleId"
         WHERE r.name IN ('HR', 'HR_Specialist', 'super_admin')
           AND r."deletedAt" IS NULL AND u."deletedAt" IS NULL`,
      )) as Array<{ id: string }>;

      for (const hr of hrUsers) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications
             (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
           VALUES
             (gen_random_uuid(), $1, 'BREAK_EXCEEDED',
              'تجاوز وقت الاستراحة', 'Break Over Limit', $2, $3, false, NOW())`,
          hr.id,
          `الموظف ${empName} تجاوز وقت الاستراحة بـ ${overMinutes} دقيقة يوم ${dateStr}`,
          `Employee ${empName} exceeded break time by ${overMinutes} min on ${dateStr}`,
        );
      }
    } catch {
      // إشعار فاشل لا يوقف العملية
    }
  }

  /** Phase 7.4: كشف السلوك الشاذ — عمل زائد > 4h، بصمات كثيرة > 8، لا بصمة ولا إجازة */
  private async processAnomalyDetection(dateStr: string): Promise<void> {
    try {
      // 7.4-a: workedMinutes > scheduledMinutes + 4h
      const overtimeAnomalies = (await this.prisma.$queryRawUnsafe(
        `WITH sched AS (
           SELECT ar.id, ar."employeeId", ar."workedMinutes",
                  CASE
                    WHEN ws."workStartTime" IS NOT NULL AND ws."workEndTime" IS NOT NULL THEN
                      GREATEST(240,
                        EXTRACT(EPOCH FROM (
                          CASE WHEN ws."workEndTime"::time >= ws."workStartTime"::time
                            THEN ws."workEndTime"::time - ws."workStartTime"::time
                            ELSE ws."workEndTime"::time - ws."workStartTime"::time + interval '24 hours'
                          END
                        ))::int / 60 - COALESCE(ws."breakDurationMin", 0)
                      )
                    ELSE 480
                  END AS "scheduledMinutes"
           FROM attendance.attendance_records ar
           JOIN attendance.employee_schedules es
             ON es."employeeId" = ar."employeeId"
             AND $1::date BETWEEN es."effectiveFrom"::date
                 AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)
             AND es."isActive" = true
           JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
           WHERE ar.date = $1::date
             AND ar."workedMinutes" IS NOT NULL
             AND ar.status NOT IN ('ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'PARTIAL_LEAVE', 'ABSENT')
         )
         SELECT id, "employeeId", "workedMinutes", "scheduledMinutes"
         FROM sched
         WHERE "workedMinutes" > "scheduledMinutes" + 240`,
        dateStr,
      )) as Array<{ id: string; employeeId: string; workedMinutes: number; scheduledMinutes: number }>;

      for (const r of overtimeAnomalies) {
        const extraMinutes = r.workedMinutes - r.scheduledMinutes;
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO attendance.attendance_alerts
             (id, "employeeId", date, "alertType", severity, message, "messageAr",
              status, "isAutoGenerated", "createdAt", "updatedAt")
           VALUES
             (gen_random_uuid(), $1, $2::date, 'ANOMALY_OVERTIME', 'MEDIUM', $3, $4,
              'OPEN', true, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          r.employeeId, dateStr,
          `Worked ${r.workedMinutes} min — ${extraMinutes} min over schedule (+4h threshold exceeded)`,
          `عمل ${r.workedMinutes} دقيقة — تجاوز الجدول بـ ${extraMinutes} دقيقة (يتجاوز حد 4 ساعات)`,
        ).catch(() => {});
      }

      // 7.4-b: عدد بصمات > 8
      const manyStamps = (await this.prisma.$queryRawUnsafe(
        `SELECT ar."employeeId", COUNT(ral.id)::int AS stamp_count
         FROM attendance.attendance_records ar
         JOIN biometric.raw_attendance_logs ral
           ON ral."employeeId" = ar."employeeId"
           AND ral.timestamp >= $1::date
           AND ral.timestamp < $1::date + INTERVAL '30 hours'
         WHERE ar.date = $1::date
           AND ar.status NOT IN ('ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'ABSENT')
         GROUP BY ar."employeeId"
         HAVING COUNT(ral.id) > 8`,
        dateStr,
      )) as Array<{ employeeId: string; stamp_count: number }>;

      for (const r of manyStamps) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO attendance.attendance_alerts
             (id, "employeeId", date, "alertType", severity, message, "messageAr",
              status, "isAutoGenerated", "createdAt", "updatedAt")
           VALUES
             (gen_random_uuid(), $1, $2::date, 'ANOMALY_MANY_STAMPS', 'LOW', $3, $4,
              'OPEN', true, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          r.employeeId, dateStr,
          `Unusual number of stamps: ${r.stamp_count} (threshold: 8)`,
          `عدد بصمات غير معتاد: ${r.stamp_count} (الحد المسموح: 8)`,
        ).catch(() => {});
      }

      // 7.4-c: لا بصمة + لا إجازة (موظف مجدول لكن لا حضور ولا بصمة في biometric)
      const scheduledEmployees = (await this.prisma.$queryRawUnsafe(
        `SELECT es."employeeId"
         FROM attendance.employee_schedules es
         JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
         JOIN users.employees e ON e.id = es."employeeId"
         WHERE es."isActive" = true
           AND e."employmentStatus" = 'ACTIVE'
           AND e."deletedAt" IS NULL
           AND $1::date BETWEEN es."effectiveFrom"::date
               AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)`,
        dateStr,
      )) as Array<{ employeeId: string }>;

      if (scheduledEmployees.length > 0) {
        const empIds = scheduledEmployees.map(e => e.employeeId);
        const withStamps = (await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT "employeeId"
           FROM biometric.raw_attendance_logs
           WHERE "employeeId" = ANY($1::text[])
             AND timestamp >= $2::date
             AND timestamp < $2::date + INTERVAL '30 hours'`,
          empIds, dateStr,
        )) as Array<{ employeeId: string }>;

        const withLeave = (await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT "employeeId"
           FROM leaves.leave_requests
           WHERE "employeeId" = ANY($1::text[])
             AND "startDate"::date <= $2::date
             AND "endDate"::date >= $2::date
             AND status = 'APPROVED'
             AND "deletedAt" IS NULL`,
          empIds, dateStr,
        )) as Array<{ employeeId: string }>;

        const stampSet = new Set(withStamps.map(r => r.employeeId));
        const leaveSet = new Set(withLeave.map(r => r.employeeId));

        for (const emp of empIds) {
          if (!stampSet.has(emp) && !leaveSet.has(emp)) {
            await this.prisma.$queryRawUnsafe(
              `INSERT INTO attendance.attendance_alerts
                 (id, "employeeId", date, "alertType", severity, message, "messageAr",
                  status, "isAutoGenerated", "createdAt", "updatedAt")
               VALUES
                 (gen_random_uuid(), $1, $2::date, 'ANOMALY_NO_STAMP', 'HIGH', $3, $4,
                  'OPEN', true, NOW(), NOW())
               ON CONFLICT DO NOTHING`,
              emp, dateStr,
              `No biometric stamp and no approved leave on ${dateStr}`,
              `لا توجد بصمة بيومترية ولا إجازة معتمدة بتاريخ ${dateStr}`,
            ).catch(() => {});
          }
        }
      }

      if (overtimeAnomalies.length + manyStamps.length > 0) {
        this.logger.log(
          `Anomaly detection for ${dateStr}: ${overtimeAnomalies.length} overtime, ${manyStamps.length} many-stamps`,
        );
      }
    } catch (err) {
      this.logger.error(`processAnomalyDetection failed for ${dateStr}: ${(err as any)?.message}`);
    }
  }

  /**
   * C.7: حساب الإضافي من طلبات التكليف المعتمدة فقط (Section 1-ج)
   * يُصفَّر الإضافي إذا لا يوجد طلب معتمد يغطي الموظف واليوم.
   */
  private async processOvertimeFromRequests(dateStr: string): Promise<void> {
    try {
      const records = (await this.prisma.$queryRawUnsafe(
        `SELECT ar.id, ar."employeeId", ar."clockInTime", ar."clockOutTime",
                ar."workedMinutes",
                COALESCE(ws."workStartTime", '') AS "workStartTime",
                COALESCE(ws."workEndTime", '')   AS "workEndTime",
                COALESCE(ws."shiftType", 'DAY')  AS "shiftType",
                ws."minimumWorkMinutes"
         FROM attendance.attendance_records ar
         LEFT JOIN attendance.employee_schedules es ON es."employeeId" = ar."employeeId"
           AND $1::date BETWEEN es."effectiveFrom"::date
               AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)
           AND es."isActive" = true
         LEFT JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
         WHERE ar.date = $1::date
           AND ar."clockInTime" IS NOT NULL
           AND ar."clockOutTime" IS NOT NULL
           AND ar.status NOT IN ('ABSENT', 'ON_LEAVE')`,
        dateStr,
      )) as Array<{
        id: string; employeeId: string;
        clockInTime: Date; clockOutTime: Date; workedMinutes: number | null;
        workStartTime: string; workEndTime: string;
        shiftType: string; minimumWorkMinutes: number | null;
      }>;

      const holiday = await this.getHolidayForDate(dateStr);
      const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay();
      const isOffDay = !!holiday || dow === 5 || dow === 6;

      for (const rec of records) {
        try {
          const reqs = (await this.prisma.$queryRawUnsafe(
            `SELECT id, type, details FROM requests.requests
             WHERE status = 'APPROVED' AND "deletedAt" IS NULL
               AND (
                 (type = 'OVERTIME_EMPLOYEE'
                   AND "employeeId" = $1
                   AND (details->>'overtimeDate')::date = $2::date)
                 OR
                 (type = 'OVERTIME_MANAGER'
                   AND (details->'employeeIds')::jsonb @> to_jsonb($1::text)
                   AND (details->>'startDate')::date <= $2::date
                   AND (details->>'endDate')::date >= $2::date)
               )`,
            rec.employeeId, dateStr,
          )) as Array<{ id: string; type: string; details: any }>;

          if (reqs.length === 0) {
            await this.prisma.$queryRawUnsafe(
              `UPDATE attendance.attendance_records
               SET "overtimeWorkdayMinutes" = 0, "overtimeHolidayMinutes" = 0,
                   "overtimeMinutes" = 0, "overtimeRequestId" = NULL, "updatedAt" = NOW()
               WHERE id = $1`,
              rec.id,
            );
            continue;
          }

          const totalCapMin = reqs.reduce((s, r) => s + (parseFloat(r.details?.totalHours ?? '0') || 0) * 60, 0);
          const firstReqId = reqs[0].id;
          let overtimeWorkday = 0;
          let overtimeHoliday = 0;

          if (isOffDay) {
            overtimeHoliday = Math.min(rec.workedMinutes ?? 0, totalCapMin);
          } else if (rec.shiftType === 'FLEXIBLE') {
            const aboveMin = Math.max(0, (rec.workedMinutes ?? 0) - (rec.minimumWorkMinutes ?? 480));
            let intersectTotal = 0;
            for (const r of reqs) {
              const cap = (parseFloat(r.details?.totalHours ?? '0') || 0) * 60;
              intersectTotal += Math.min(this.calcWindowIntersect(rec.clockInTime, rec.clockOutTime, dateStr, r.details?.startTime, r.details?.endTime), cap);
            }
            overtimeWorkday = Math.min(aboveMin, Math.min(intersectTotal, totalCapMin));
          } else if (rec.workStartTime && rec.workEndTime) {
            const [sH, sM] = rec.workStartTime.split(':').map(Number);
            const [eH, eM] = rec.workEndTime.split(':').map(Number);
            const base = new Date(dateStr + 'T00:00:00Z');
            const shiftStart = new Date(base); shiftStart.setUTCHours(sH - 3, sM, 0, 0);
            const shiftEnd = new Date(base);   shiftEnd.setUTCHours(eH - 3, eM, 0, 0);
            if (shiftEnd <= shiftStart) shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);

            const preShift  = Math.max(0, Math.floor((Math.min(rec.clockOutTime.getTime(), shiftStart.getTime()) - rec.clockInTime.getTime()) / 60000));
            const postShift = Math.max(0, Math.floor((rec.clockOutTime.getTime() - Math.max(rec.clockInTime.getTime(), shiftEnd.getTime())) / 60000));
            const outsideShift = preShift + postShift;

            let intersectTotal = 0;
            for (const r of reqs) {
              const cap = (parseFloat(r.details?.totalHours ?? '0') || 0) * 60;
              const windowIntersect = this.calcWindowIntersect(rec.clockInTime, rec.clockOutTime, dateStr, r.details?.startTime, r.details?.endTime);
              intersectTotal += Math.min(Math.min(windowIntersect, outsideShift), cap);
            }
            overtimeWorkday = Math.min(intersectTotal, totalCapMin);
          }

          await this.prisma.$queryRawUnsafe(
            `UPDATE attendance.attendance_records
             SET "overtimeWorkdayMinutes" = $1, "overtimeHolidayMinutes" = $2,
                 "overtimeMinutes" = $3, "overtimeRequestId" = $4, "updatedAt" = NOW()
             WHERE id = $5`,
            overtimeWorkday, overtimeHoliday, overtimeWorkday + overtimeHoliday, firstReqId, rec.id,
          );
        } catch (err) {
          this.logger.error(`Overtime calc failed for ${rec.employeeId} on ${dateStr}: ${(err as any)?.message}`);
        }
      }
    } catch (err) {
      this.logger.error(`processOvertimeFromRequests failed for ${dateStr}: ${(err as any)?.message}`);
    }
  }

  /** Intersection in minutes between [clockIn, clockOut] and the request time window on a given date (times in Asia/Riyadh format "HH:mm") */
  private calcWindowIntersect(clockIn: Date, clockOut: Date, dateStr: string, windowStart?: string, windowEnd?: string): number {
    if (!windowStart || !windowEnd) return 0;
    const [wsH, wsM] = windowStart.split(':').map(Number);
    const [weH, weM] = windowEnd.split(':').map(Number);
    const base = new Date(dateStr + 'T00:00:00Z');
    const wStart = new Date(base); wStart.setUTCHours(wsH - 3, wsM, 0, 0);
    const wEnd   = new Date(base); wEnd.setUTCHours(weH - 3, weM, 0, 0);
    if (wEnd <= wStart) wEnd.setUTCDate(wEnd.getUTCDate() + 1);
    const start = Math.max(clockIn.getTime(), wStart.getTime());
    const end   = Math.min(clockOut.getTime(), wEnd.getTime());
    return Math.max(0, Math.floor((end - start) / 60000));
  }

  async auditLog(
    attendanceRecordId: string | null,
    employeeId: string,
    dateStr: string,
    action: string,
    source: string,
    notes: string,
    changedFields?: Record<string, { from: unknown; to: unknown }>,
  ) {
    try {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO attendance.attendance_computation_logs
           (id, "attendanceRecordId", "employeeId", date, action, source,
            "changedFields", "performedBy", notes, "createdAt")
         VALUES
           (gen_random_uuid(), $1, $2, $3::date, $4, $5, $6, 'SYSTEM', $7, NOW())`,
        attendanceRecordId ?? null,
        employeeId,
        dateStr,
        action,
        source,
        changedFields ? JSON.stringify(changedFields) : null,
        notes,
      );
    } catch {
      // audit log failure لا يوقف العملية الأساسية
    }
  }
}
