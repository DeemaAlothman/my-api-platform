import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface RecordRow {
  id: string;
  employeeId: string;
  date: Date;
  clockInTime: Date;
  clockOutTime: Date;
  status: string;
  workedMinutes: number | null;
  totalBreakMinutes: number;
  netWorkedMinutes: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number | null;
}

interface ScheduleRow {
  workStartTime: string;
  workEndTime: string;
  lateToleranceMin: number;
  earlyLeaveToleranceMin: number;
  allowOvertime: boolean;
  maxOvertimeHours: number | null;
}

interface ComputedResult {
  recordId: string;
  employeeId: string;
  dateStr: string;
  current: {
    workedMinutes: number | null;
    totalBreakMinutes: number;
    netWorkedMinutes: number | null;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number | null;
    status: string;
  };
  proposed: {
    workedMinutes: number;
    totalBreakMinutes: number;
    netWorkedMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    status: string;
  };
  willChange: boolean;
}

const PROTECTED_STATUSES = ['ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'ABSENT'];

@Injectable()
export class BackfillService {
  private readonly logger = new Logger(BackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dry-run: يحسب ماذا سيتغير بدون كتابة أي شيء
   */
  async dryRun(options: {
    dateFrom?: string;
    dateTo?: string;
    employeeId?: string;
  }): Promise<{
    total: number;
    wouldChange: number;
    wouldSkip: number;
    changes: ComputedResult[];
  }> {
    const records = await this.fetchRecords(options);
    const results: ComputedResult[] = [];

    for (const rec of records) {
      const result = await this.computeRecord(rec);
      results.push(result);
    }

    const wouldChange = results.filter(r => r.willChange);
    return {
      total: results.length,
      wouldChange: wouldChange.length,
      wouldSkip: results.length - wouldChange.length,
      changes: wouldChange,
    };
  }

  /**
   * Apply: نفس الحساب لكن يكتب في DB على دفعات
   */
  async apply(options: {
    dateFrom?: string;
    dateTo?: string;
    employeeId?: string;
    batchSize?: number;
  }): Promise<{
    total: number;
    updated: number;
    skipped: number;
    errors: number;
  }> {
    const records = await this.fetchRecords(options);
    const batchSize = options.batchSize ?? 50;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      this.logger.log(`Backfill batch ${i + 1}-${i + batch.length} of ${records.length}`);

      for (const rec of batch) {
        try {
          const result = await this.computeRecord(rec);
          if (!result.willChange) {
            skipped++;
            continue;
          }
          await this.applyRecord(result);
          updated++;
        } catch (err) {
          errors++;
          this.logger.error(`Backfill error for record ${rec.id}: ${(err as any)?.message}`);
        }
      }
    }

    return { total: records.length, updated, skipped, errors };
  }

  private async fetchRecords(options: {
    dateFrom?: string;
    dateTo?: string;
    employeeId?: string;
  }): Promise<RecordRow[]> {
    const conditions: string[] = [
      `"clockInTime" IS NOT NULL`,
      `"clockOutTime" IS NOT NULL`,
    ];
    const params: unknown[] = [];

    if (options.employeeId) {
      params.push(options.employeeId);
      conditions.push(`"employeeId" = $${params.length}`);
    }
    if (options.dateFrom) {
      params.push(options.dateFrom);
      conditions.push(`date >= $${params.length}::date`);
    }
    if (options.dateTo) {
      params.push(options.dateTo);
      conditions.push(`date <= $${params.length}::date`);
    }

    const where = conditions.join(' AND ');
    const sql = `
      SELECT id, "employeeId", date, "clockInTime", "clockOutTime",
             status, "workedMinutes", "totalBreakMinutes", "netWorkedMinutes",
             "lateMinutes", "earlyLeaveMinutes", "overtimeMinutes"
      FROM attendance.attendance_records
      WHERE ${where}
      ORDER BY date ASC
    `;

    return this.prisma.$queryRawUnsafe(sql, ...params) as Promise<RecordRow[]>;
  }

  private async computeRecord(rec: RecordRow): Promise<ComputedResult> {
    const dateStr = rec.date instanceof Date
      ? rec.date.toISOString().split('T')[0]
      : String(rec.date).split('T')[0];

    // جلب البريكات
    const breaks = (await this.prisma.$queryRawUnsafe(
      `SELECT "durationMinutes" FROM attendance.attendance_breaks
       WHERE "attendanceRecordId" = $1`,
      rec.id,
    )) as Array<{ durationMinutes: number | null }>;

    const totalBreakMinutes = breaks.reduce((s, b) => s + (b.durationMinutes ?? 0), 0);
    const workedMinutes = Math.floor(
      (rec.clockOutTime.getTime() - rec.clockInTime.getTime()) / 60000,
    );
    const netWorkedMinutes = Math.max(0, workedMinutes - totalBreakMinutes);

    // جلب جدول الدوام
    const schedules = (await this.prisma.$queryRawUnsafe(
      `SELECT ws."workStartTime", ws."workEndTime",
              ws."lateToleranceMin", ws."earlyLeaveToleranceMin",
              ws."allowOvertime", ws."maxOvertimeHours"
       FROM attendance.employee_schedules es
       JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
       WHERE es."employeeId" = $1
         AND $2::date BETWEEN es."effectiveFrom"::date
             AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)
         AND es."isActive" = true
       LIMIT 1`,
      rec.employeeId,
      dateStr,
    )) as ScheduleRow[];

    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;

    if (schedules[0]) {
      const s = schedules[0];
      const [startH, startM] = s.workStartTime.split(':').map(Number);
      const [endH, endM] = s.workEndTime.split(':').map(Number);

      const scheduledStart = new Date(rec.clockInTime);
      scheduledStart.setUTCHours(startH - 3, startM, 0, 0);

      const scheduledEnd = new Date(rec.clockOutTime);
      scheduledEnd.setUTCHours(endH - 3, endM, 0, 0);

      const lateRaw = Math.floor((rec.clockInTime.getTime() - scheduledStart.getTime()) / 60000);
      const earlyRaw = Math.floor((scheduledEnd.getTime() - rec.clockOutTime.getTime()) / 60000);
      const overtimeRaw = Math.floor((rec.clockOutTime.getTime() - scheduledEnd.getTime()) / 60000);

      lateMinutes = Math.max(0, lateRaw - (s.lateToleranceMin || 0));
      earlyLeaveMinutes = Math.max(0, earlyRaw - (s.earlyLeaveToleranceMin || 0));

      if (s.allowOvertime && overtimeRaw > 0) {
        const maxMin = s.maxOvertimeHours ? s.maxOvertimeHours * 60 : Infinity;
        overtimeMinutes = Math.min(overtimeRaw, maxMin);
      }
    }

    // تحديد الـ status الجديد — لا نلمس الحالات المحمية
    let newStatus = rec.status;
    if (!PROTECTED_STATUSES.includes(rec.status)) {
      newStatus = lateMinutes > 0 ? 'LATE' : earlyLeaveMinutes > 0 ? 'EARLY_LEAVE' : 'PRESENT';
    }

    const proposed = { workedMinutes, totalBreakMinutes, netWorkedMinutes, lateMinutes, earlyLeaveMinutes, overtimeMinutes, status: newStatus };
    const current = {
      workedMinutes: rec.workedMinutes,
      totalBreakMinutes: rec.totalBreakMinutes,
      netWorkedMinutes: rec.netWorkedMinutes,
      lateMinutes: rec.lateMinutes,
      earlyLeaveMinutes: rec.earlyLeaveMinutes,
      overtimeMinutes: rec.overtimeMinutes,
      status: rec.status,
    };

    const willChange =
      current.workedMinutes !== proposed.workedMinutes ||
      current.totalBreakMinutes !== proposed.totalBreakMinutes ||
      current.netWorkedMinutes !== proposed.netWorkedMinutes ||
      current.lateMinutes !== proposed.lateMinutes ||
      current.earlyLeaveMinutes !== proposed.earlyLeaveMinutes ||
      current.overtimeMinutes !== proposed.overtimeMinutes ||
      current.status !== proposed.status;

    return { recordId: rec.id, employeeId: rec.employeeId, dateStr, current, proposed, willChange };
  }

  private async applyRecord(result: ComputedResult) {
    const { recordId, employeeId, dateStr, current, proposed } = result;

    await this.prisma.$queryRawUnsafe(
      `UPDATE attendance.attendance_records
       SET "workedMinutes"     = $1,
           "totalBreakMinutes" = $2,
           "netWorkedMinutes"  = $3,
           "lateMinutes"       = $4,
           "earlyLeaveMinutes" = $5,
           "overtimeMinutes"   = $6,
           status              = $7,
           "updatedAt"         = NOW()
       WHERE id = $8`,
      proposed.workedMinutes,
      proposed.totalBreakMinutes,
      proposed.netWorkedMinutes,
      proposed.lateMinutes,
      proposed.earlyLeaveMinutes,
      proposed.overtimeMinutes,
      proposed.status,
      recordId,
    );

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    if (current.workedMinutes !== proposed.workedMinutes)
      changedFields.workedMinutes = { from: current.workedMinutes, to: proposed.workedMinutes };
    if (current.lateMinutes !== proposed.lateMinutes)
      changedFields.lateMinutes = { from: current.lateMinutes, to: proposed.lateMinutes };
    if (current.earlyLeaveMinutes !== proposed.earlyLeaveMinutes)
      changedFields.earlyLeaveMinutes = { from: current.earlyLeaveMinutes, to: proposed.earlyLeaveMinutes };
    if (current.overtimeMinutes !== proposed.overtimeMinutes)
      changedFields.overtimeMinutes = { from: current.overtimeMinutes, to: proposed.overtimeMinutes };
    if (current.status !== proposed.status)
      changedFields.status = { from: current.status, to: proposed.status };

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO attendance.attendance_computation_logs
         (id, "attendanceRecordId", "employeeId", date, action, source,
          "changedFields", "performedBy", notes, "createdAt")
       VALUES
         (gen_random_uuid(), $1, $2, $3::date, 'BACKFILL_RECOMPUTE', 'BACKFILL',
          $4, 'SYSTEM', 'إعادة حساب تلقائية من P2 backfill', NOW())`,
      recordId,
      employeeId,
      dateStr,
      JSON.stringify(changedFields),
    );
  }
}
