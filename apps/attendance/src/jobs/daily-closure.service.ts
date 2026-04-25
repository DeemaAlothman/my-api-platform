import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DailyClosureService implements OnModuleInit {
  private readonly logger = new Logger(DailyClosureService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.scheduleNextRun();
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
    skipped: number;
  }> {
    const date = new Date(dateStr + 'T00:00:00Z');
    const dayOfWeek = date.getUTCDay();

    const scheduledEmployees = (await this.prisma.$queryRawUnsafe(
      `SELECT es."employeeId", ws."workDays"
       FROM attendance.employee_schedules es
       JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
       WHERE es."isActive" = true
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
      return { date: dateStr, absentCreated: 0, missingClockOutAlerts: 0, onLeaveApplied: 0, skipped: 0 };
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

    let absentCreated = 0;
    let missingClockOutAlerts = 0;
    let onLeaveApplied = 0;
    let skipped = 0;

    for (const employeeId of workingEmployeeIds) {
      const record = recordMap.get(employeeId);

      // موظف عنده إجازة معتمدة → ON_LEAVE أو PARTIAL_LEAVE
      const leave = leaveMap.get(employeeId);
      if (leave) {
        await this.upsertLeaveRecord(employeeId, dateStr, leave);
        onLeaveApplied++;
        continue;
      }

      if (!record) {
        await this.createAbsentRecord(employeeId, dateStr);
        absentCreated++;
      } else if (['ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'ABSENT'].includes(record.status)) {
        skipped++;
      } else if (record.clockInTime && !record.clockOutTime) {
        await this.createMissingClockOutAlert(employeeId, dateStr);
        missingClockOutAlerts++;
      } else {
        skipped++;
      }
    }

    return { date: dateStr, absentCreated, missingClockOutAlerts, onLeaveApplied, skipped };
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

  private async createAbsentRecord(employeeId: string, dateStr: string) {
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

      await this.auditLog(null, employeeId, dateStr, 'ABSENT_CREATED', 'DAILY_CLOSURE',
        `تم إنشاء سجل غياب تلقائي ليوم ${dateStr}`);
    } catch (err) {
      this.logger.error(`Failed to create ABSENT for ${employeeId} on ${dateStr}: ${(err as any)?.message}`);
    }
  }

  private async createMissingClockOutAlert(employeeId: string, dateStr: string) {
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
