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
  lateCompensatedMinutes: number;
  longestContinuousWorkMinutes: number | null;
  punchSequenceStatus: string | null;
}

interface ScheduleRow {
  workStartTime: string;
  workEndTime: string;
  lateToleranceMin: number;
  earlyLeaveToleranceMin: number;
  allowOvertime: boolean;
  maxOvertimeHours: number | null;
  shiftType: string | null;
  minimumWorkMinutes: number | null;
  requiresContinuousWork: boolean | null;
}

export interface ComputedResult {
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
    lateCompensatedMinutes: number;
    longestContinuousWorkMinutes: number | null;
    punchSequenceStatus: string | null;
    status: string;
  };
  proposed: {
    workedMinutes: number;
    totalBreakMinutes: number;
    netWorkedMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    lateCompensatedMinutes: number;
    longestContinuousWorkMinutes: number;
    punchSequenceStatus: string;
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
    useNewBusinessRules?: boolean;
  }): Promise<{
    total: number;
    wouldChange: number;
    wouldSkip: number;
    changes: ComputedResult[];
  }> {
    const useNew = options.useNewBusinessRules ?? false;
    const records = await this.fetchRecords(options);
    const results: ComputedResult[] = [];

    for (const rec of records) {
      const result = await this.computeRecord(rec, useNew);
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
    useNewBusinessRules?: boolean;
  }): Promise<{
    total: number;
    updated: number;
    skipped: number;
    errors: number;
  }> {
    const useNew = options.useNewBusinessRules ?? false;
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
          const result = await this.computeRecord(rec, useNew);
          if (!result.willChange) {
            skipped++;
            continue;
          }
          await this.applyRecord(result, useNew);
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
             "lateMinutes", "earlyLeaveMinutes", "overtimeMinutes",
             COALESCE("lateCompensatedMinutes", 0) AS "lateCompensatedMinutes",
             "longestContinuousWorkMinutes", "punchSequenceStatus"
      FROM attendance.attendance_records
      WHERE ${where}
      ORDER BY date ASC
    `;

    return this.prisma.$queryRawUnsafe(sql, ...params) as Promise<RecordRow[]>;
  }

  private async computeRecord(rec: RecordRow, useNewBusinessRules = false): Promise<ComputedResult> {
    const dateStr = rec.date instanceof Date
      ? rec.date.toISOString().split('T')[0]
      : String(rec.date).split('T')[0];

    // جلب البريكات
    const breaks = (await this.prisma.$queryRawUnsafe(
      `SELECT "durationMinutes", "breakOut", "breakIn" FROM attendance.attendance_breaks
       WHERE "attendanceRecordId" = $1 ORDER BY "breakOut" ASC`,
      rec.id,
    )) as Array<{ durationMinutes: number | null; breakOut: Date | null; breakIn: Date | null }>;

    const totalBreakMinutes = breaks.reduce((s, b) => s + (b.durationMinutes ?? 0), 0);
    const workedMinutes = Math.floor(
      (rec.clockOutTime.getTime() - rec.clockInTime.getTime()) / 60000,
    );
    const netWorkedMinutes = Math.max(0, workedMinutes - totalBreakMinutes);

    // جلب جدول الدوام
    const schedules = (await this.prisma.$queryRawUnsafe(
      `SELECT ws."workStartTime", ws."workEndTime",
              ws."lateToleranceMin", ws."earlyLeaveToleranceMin",
              ws."allowOvertime", ws."maxOvertimeHours",
              ws."shiftType", ws."minimumWorkMinutes", ws."requiresContinuousWork"
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
    let lateCompensatedMinutes = 0;
    let longestContinuousWorkMinutes = workedMinutes;
    const punchSequenceStatus = 'VALID'; // backfill يعمل فقط على سجلات مكتملة

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

      if (useNewBusinessRules) {
        // lateCompensatedMinutes: إذا خرج بعد نهاية الوردية يعوّض عن جزء من التأخير
        const excessMinutes = Math.max(0, overtimeRaw);
        lateCompensatedMinutes = Math.min(excessMinutes, lateMinutes);

        // longestContinuousWorkMinutes
        longestContinuousWorkMinutes = this.calcLongestContinuous(
          rec.clockInTime, rec.clockOutTime, breaks,
        );

        // للوردية المرنة: التأخير والخروج المبكر لا تُطبَّق
        if (s.shiftType === 'FLEXIBLE') {
          lateMinutes = 0;
          earlyLeaveMinutes = 0;
        }
      }
    }

    // تحديد الـ status الجديد — لا نلمس الحالات المحمية
    let newStatus = rec.status;
    if (!PROTECTED_STATUSES.includes(rec.status)) {
      if (useNewBusinessRules && schedules[0]?.shiftType === 'FLEXIBLE') {
        const s = schedules[0];
        const checkMinutes = s.requiresContinuousWork ? longestContinuousWorkMinutes : netWorkedMinutes;
        newStatus = (s.minimumWorkMinutes != null && checkMinutes < s.minimumWorkMinutes)
          ? 'EARLY_LEAVE'
          : 'PRESENT';
      } else {
        newStatus = lateMinutes > 0 ? 'LATE' : earlyLeaveMinutes > 0 ? 'EARLY_LEAVE' : 'PRESENT';
      }
    }

    const proposed = {
      workedMinutes, totalBreakMinutes, netWorkedMinutes,
      lateMinutes, earlyLeaveMinutes, overtimeMinutes,
      lateCompensatedMinutes, longestContinuousWorkMinutes, punchSequenceStatus,
      status: newStatus,
    };
    const current = {
      workedMinutes: rec.workedMinutes,
      totalBreakMinutes: rec.totalBreakMinutes,
      netWorkedMinutes: rec.netWorkedMinutes,
      lateMinutes: rec.lateMinutes,
      earlyLeaveMinutes: rec.earlyLeaveMinutes,
      overtimeMinutes: rec.overtimeMinutes,
      lateCompensatedMinutes: rec.lateCompensatedMinutes,
      longestContinuousWorkMinutes: rec.longestContinuousWorkMinutes,
      punchSequenceStatus: rec.punchSequenceStatus,
      status: rec.status,
    };

    const willChange =
      current.workedMinutes !== proposed.workedMinutes ||
      current.totalBreakMinutes !== proposed.totalBreakMinutes ||
      current.netWorkedMinutes !== proposed.netWorkedMinutes ||
      current.lateMinutes !== proposed.lateMinutes ||
      current.earlyLeaveMinutes !== proposed.earlyLeaveMinutes ||
      current.overtimeMinutes !== proposed.overtimeMinutes ||
      (useNewBusinessRules && current.lateCompensatedMinutes !== proposed.lateCompensatedMinutes) ||
      (useNewBusinessRules && current.longestContinuousWorkMinutes !== proposed.longestContinuousWorkMinutes) ||
      (useNewBusinessRules && current.punchSequenceStatus !== proposed.punchSequenceStatus) ||
      current.status !== proposed.status;

    return { recordId: rec.id, employeeId: rec.employeeId, dateStr, current, proposed, willChange };
  }

  private calcLongestContinuous(
    clockIn: Date,
    clockOut: Date,
    breaks: Array<{ breakOut: Date | null; breakIn: Date | null }>,
  ): number {
    const completed = breaks
      .filter(b => b.breakOut !== null && b.breakIn !== null)
      .sort((a, b) => a.breakOut!.getTime() - b.breakOut!.getTime());

    if (completed.length === 0) {
      return Math.max(0, Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000));
    }

    let longest = 0;
    let segStart = clockIn;
    for (const b of completed) {
      const dur = Math.floor((b.breakOut!.getTime() - segStart.getTime()) / 60000);
      if (dur > longest) longest = dur;
      segStart = b.breakIn!;
    }
    const last = Math.floor((clockOut.getTime() - segStart.getTime()) / 60000);
    if (last > longest) longest = last;
    return Math.max(0, longest);
  }

  private async applyRecord(result: ComputedResult, useNewBusinessRules = false) {
    const { recordId, employeeId, dateStr, current, proposed } = result;

    if (useNewBusinessRules) {
      await this.prisma.$queryRawUnsafe(
        `UPDATE attendance.attendance_records
         SET "workedMinutes"                = $1,
             "totalBreakMinutes"            = $2,
             "netWorkedMinutes"             = $3,
             "lateMinutes"                  = $4,
             "earlyLeaveMinutes"            = $5,
             "overtimeMinutes"              = $6,
             "lateCompensatedMinutes"       = $7,
             "longestContinuousWorkMinutes" = $8,
             "punchSequenceStatus"          = $9,
             status                         = $10,
             "updatedAt"                    = NOW()
         WHERE id = $11`,
        proposed.workedMinutes,
        proposed.totalBreakMinutes,
        proposed.netWorkedMinutes,
        proposed.lateMinutes,
        proposed.earlyLeaveMinutes,
        proposed.overtimeMinutes,
        proposed.lateCompensatedMinutes,
        proposed.longestContinuousWorkMinutes,
        proposed.punchSequenceStatus,
        proposed.status,
        recordId,
      );
    } else {
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
    }

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    if (current.workedMinutes !== proposed.workedMinutes)
      changedFields.workedMinutes = { from: current.workedMinutes, to: proposed.workedMinutes };
    if (current.lateMinutes !== proposed.lateMinutes)
      changedFields.lateMinutes = { from: current.lateMinutes, to: proposed.lateMinutes };
    if (current.earlyLeaveMinutes !== proposed.earlyLeaveMinutes)
      changedFields.earlyLeaveMinutes = { from: current.earlyLeaveMinutes, to: proposed.earlyLeaveMinutes };
    if (current.overtimeMinutes !== proposed.overtimeMinutes)
      changedFields.overtimeMinutes = { from: current.overtimeMinutes, to: proposed.overtimeMinutes };
    if (useNewBusinessRules && current.lateCompensatedMinutes !== proposed.lateCompensatedMinutes)
      changedFields.lateCompensatedMinutes = { from: current.lateCompensatedMinutes, to: proposed.lateCompensatedMinutes };
    if (useNewBusinessRules && current.longestContinuousWorkMinutes !== proposed.longestContinuousWorkMinutes)
      changedFields.longestContinuousWorkMinutes = { from: current.longestContinuousWorkMinutes, to: proposed.longestContinuousWorkMinutes };
    if (useNewBusinessRules && current.punchSequenceStatus !== proposed.punchSequenceStatus)
      changedFields.punchSequenceStatus = { from: current.punchSequenceStatus, to: proposed.punchSequenceStatus };
    if (current.status !== proposed.status)
      changedFields.status = { from: current.status, to: proposed.status };

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO attendance.attendance_computation_logs
         (id, "attendanceRecordId", "employeeId", date, action, source,
          "changedFields", "performedBy", notes, "createdAt")
       VALUES
         (gen_random_uuid(), $1, $2, $3::date, 'BACKFILL_RECOMPUTE', 'BACKFILL',
          $4, 'SYSTEM', $5, NOW())`,
      recordId,
      employeeId,
      dateStr,
      JSON.stringify(changedFields),
      useNewBusinessRules ? 'إعادة حساب بقواعد العمل الجديدة' : 'إعادة حساب تلقائية من P2 backfill',
    );
  }
}
