import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { shiftDayRange, toLocalDateString } from '../common/utils/timezone';

type InterpretedType = 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_OUT' | 'BREAK_IN';

interface RawLog {
  id: string;
  pin: string;
  employeeId: string | null;
  timestamp: Date;
  interpretedAs: string | null;
  pairIndex: number | null;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * يُطبَّق عند وصول بصمة جديدة لموظف محدد.
   * يُعيد حساب تفسير كل بصمات اليوم ويكتب للـ attendance schema.
   */
  async processNewStamp(logId: string, employeeId: string, deviceSN: string, timestamp: Date) {
    const dateStr = toLocalDateString(timestamp);
    const lockKey = this.hashLockKey(employeeId + dateStr);

    try {
      await this.prisma.$transaction(async (tx) => {
        // advisory lock: يمنع race condition لنفس الموظف + اليوم
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

        // 1. جلب نوع الوردية (DAY/NIGHT) لتحديد نافذة اليوم الصحيحة
        const shiftType = await this.getEmployeeShiftType(employeeId, dateStr, tx);
        const { start: startOfDay, end: endOfDay } = shiftDayRange(timestamp, shiftType);

        const todayLogs = await tx.rawAttendanceLog.findMany({
          where: {
            employeeId,
            timestamp: { gte: startOfDay, lte: endOfDay },
          },
          orderBy: { timestamp: 'asc' },
        });

        if (todayLogs.length === 0) return;

        // 2. تصفية البصمات المكررة (أقل من دقيقتين) وتعليمها
        const { kept: filteredLogs, duplicates: duplicateIds } = this.filterDuplicates(todayLogs);
        if (duplicateIds.length > 0) {
          await tx.rawAttendanceLog.updateMany({
            where: { id: { in: duplicateIds } },
            data: { interpretedAs: 'DUPLICATE_IGNORED' },
          });
        }

        // 3. تطبيق Toggle Logic
        const interpreted = this.applyToggleLogic(filteredLogs);

        // 4. تحديث interpretedAs و pairIndex (وsyncError إذا وجد تعارض rawType)
        for (const item of interpreted) {
          await tx.rawAttendanceLog.update({
            where: { id: item.id },
            data: {
              interpretedAs: item.interpretedAs,
              pairIndex: item.pairIndex,
              ...(item.syncError ? { syncError: item.syncError } : {}),
            },
          });
        }

        // 5. كتابة للـ attendance schema
        await this.writeToAttendance(employeeId, timestamp, interpreted, tx);

        // 6. وضع علامة synced على السجل الجديد
        await tx.rawAttendanceLog.update({
          where: { id: logId },
          data: { synced: true, syncedAt: new Date() },
        });
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing stamp logId=${logId}: ${msg}`);
      await this.prisma.rawAttendanceLog.update({
        where: { id: logId },
        data: { syncError: msg },
      }).catch(() => {});
    }
  }

  /**
   * FNV-1a hash → bigint للاستخدام مع pg_advisory_xact_lock
   */
  private hashLockKey(s: string): bigint {
    let hash = BigInt(2166136261);
    for (const ch of s) {
      hash ^= BigInt(ch.charCodeAt(0));
      hash = (hash * BigInt(16777619)) & BigInt('0x7FFFFFFFFFFFFFFF');
    }
    return hash;
  }

  /**
   * 3.3: جلب نوع وردية الموظف من جدول الدوام — fallback لـ DAY
   */
  private async getEmployeeShiftType(
    employeeId: string,
    dateStr: string,
    tx: any,
  ): Promise<'DAY' | 'NIGHT'> {
    try {
      const rows = await tx.$queryRaw<Array<{ shiftType: string }>>`
        SELECT ws."shiftType"
        FROM attendance.employee_schedules es
        JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
        WHERE es."employeeId" = ${employeeId}
          AND ${dateStr}::date BETWEEN es."effectiveFrom"::date
              AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)
          AND es."isActive" = true
        LIMIT 1
      `;
      const val = rows[0]?.shiftType;
      return val === 'NIGHT' ? 'NIGHT' : 'DAY';
    } catch {
      // العمود shiftType غير موجود بعد أو لا يوجد جدول دوام → افتراضي DAY
      return 'DAY';
    }
  }

  /**
   * تصفية البصمات المتكررة (أقل من دقيقتين بين بصمتين)
   * يُرجع: kept = البصمات المقبولة، duplicates = IDs المكررة للتعليم
   */
  private filterDuplicates(logs: any[]): { kept: any[]; duplicates: string[] } {
    const kept: any[] = [];
    const duplicates: string[] = [];
    for (const log of logs) {
      if (kept.length === 0) {
        kept.push(log);
        continue;
      }
      const last = kept[kept.length - 1];
      const diffMs = log.timestamp.getTime() - last.timestamp.getTime();
      if (diffMs >= 2 * 60 * 1000) { // 2 دقائق
        kept.push(log);
      } else {
        duplicates.push(log.id); // تعليم كـ DUPLICATE_IGNORED
      }
    }
    return { kept, duplicates };
  }

  /**
   * تطبيق Toggle Logic مع rawType tie-breaker (4.1):
   * N=1: rawType=1 → CLOCK_OUT (خروج بلا دخول)، غير ذلك CLOCK_IN
   * N=2: [CLOCK_IN, CLOCK_OUT]
   * N>=3: [CLOCK_IN, BREAK_OUT/BREAK_IN alternating, CLOCK_OUT]
   * tie-breaker: إذا آخر بصمتين لهما نفس rawType → تحذير في syncError
   */
  private applyToggleLogic(
    logs: any[],
  ): Array<{ id: string; interpretedAs: InterpretedType; pairIndex: number; syncError?: string }> {
    const n = logs.length;

    const result = logs.map((log, index) => {
      let interpretedAs: InterpretedType;

      if (index === 0) {
        // 4.1: rawType=1 في البصمة الأولى يعني CLOCK_OUT بلا دخول مسجَّل
        interpretedAs = (log.rawType === 1) ? 'CLOCK_OUT' : 'CLOCK_IN';
      } else if (index === n - 1) {
        interpretedAs = 'CLOCK_OUT';
      } else {
        interpretedAs = index % 2 === 1 ? 'BREAK_OUT' : 'BREAK_IN';
      }

      return { id: log.id, interpretedAs, pairIndex: index + 1, syncError: undefined as string | undefined };
    });

    // 4.1: تحقق من تعارض rawType في آخر بصمتين
    if (n >= 2) {
      const last = logs[n - 1];
      const prev = logs[n - 2];
      if (last.rawType === prev.rawType && last.rawType !== undefined) {
        const warn = `rawType conflict: last 2 stamps both have rawType=${last.rawType}`;
        this.logger.warn(warn);
        result[n - 1].syncError = warn;
      }
    }

    return result;
  }

  /**
   * كتابة النتائج لـ attendance schema مع الاستراحات وحساب workedMinutes
   */
  private async writeToAttendance(
    employeeId: string,
    timestamp: Date,
    interpreted: Array<{ id: string; interpretedAs: InterpretedType; pairIndex: number }>,
    tx: any,
  ) {
    const dateStr = toLocalDateString(timestamp);

    // جلب timestamps للبصمات المفسرة
    const logIds = interpreted.map(i => i.id);
    const rawLogs = await tx.rawAttendanceLog.findMany({
      where: { id: { in: logIds } },
      select: { id: true, timestamp: true },
    });
    const timestampMap = new Map(
      rawLogs.map((l: { id: string; timestamp: Date }) => [l.id, l.timestamp]),
    );

    const clockInItem = interpreted.find(i => i.interpretedAs === 'CLOCK_IN');
    const clockOutItem = [...interpreted].reverse().find(i => i.interpretedAs === 'CLOCK_OUT');
    const clockInTime = (clockInItem ? timestampMap.get(clockInItem.id) : null) as Date | null;
    const clockOutTime = (clockOutItem ? timestampMap.get(clockOutItem.id) : null) as Date | null;

    // إنشاء أو تحديث attendance_record وإرجاع id
    const existing = await tx.$queryRaw<Array<{ id: string; clockInTime: Date | null }>>`
      SELECT id, "clockInTime"
      FROM attendance.attendance_records
      WHERE "employeeId" = ${employeeId} AND date = ${dateStr}::date
      LIMIT 1
    `;

    let recordId: string | null = null;

    if (!existing[0]) {
      if (!clockInTime) return; // لا يمكن إنشاء سجل بدون clock-in
      const inserted = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO attendance.attendance_records
          (id, "employeeId", date, "clockInTime", "clockOutTime", status,
           "isManualEntry", "lateMinutes", "earlyLeaveMinutes", "deductionApplied",
           "createdAt", "updatedAt")
        VALUES
          (gen_random_uuid(), ${employeeId}, ${dateStr}::date, ${clockInTime}, ${clockOutTime ?? null},
           'PRESENT', false, 0, 0, false, NOW(), NOW())
        ON CONFLICT ("employeeId", date) DO UPDATE SET "updatedAt" = NOW()
        RETURNING id
      `;
      recordId = inserted[0]?.id ?? null;
    } else {
      recordId = existing[0].id;
      if (clockInTime && !existing[0].clockInTime) {
        await tx.$executeRaw`
          UPDATE attendance.attendance_records SET "clockInTime" = ${clockInTime}, "updatedAt" = NOW()
          WHERE id = ${recordId}
        `;
      }
      if (clockOutTime) {
        await tx.$executeRaw`
          UPDATE attendance.attendance_records SET "clockOutTime" = ${clockOutTime}, "updatedAt" = NOW()
          WHERE id = ${recordId}
        `;
      }
    }

    if (!recordId) return;

    // حساب أزواج الاستراحات وكتابتها
    const breakPairs = this.buildBreakPairs(interpreted, timestampMap as Map<string, Date>);

    await tx.$executeRaw`
      DELETE FROM attendance.attendance_breaks WHERE "attendanceRecordId" = ${recordId}
    `;

    for (const pair of breakPairs) {
      const duration = pair.breakIn
        ? Math.floor((pair.breakIn.getTime() - pair.breakOut.getTime()) / 60000)
        : null;
      await tx.$executeRaw`
        INSERT INTO attendance.attendance_breaks
          (id, "attendanceRecordId", "breakOut", "breakIn", "durationMinutes", "createdAt", "updatedAt")
        VALUES
          (gen_random_uuid(), ${recordId}, ${pair.breakOut}, ${pair.breakIn ?? null}, ${duration}, NOW(), NOW())
      `;
    }

    // تحديث workedMinutes / totalBreakMinutes / netWorkedMinutes
    const finalRecord = await tx.$queryRaw<Array<{ clockInTime: Date | null; clockOutTime: Date | null }>>`
      SELECT "clockInTime", "clockOutTime" FROM attendance.attendance_records WHERE id = ${recordId}
    `;

    const fin = finalRecord[0];
    if (fin?.clockInTime && fin?.clockOutTime) {
      const totalBreakMinutes = breakPairs.reduce((sum, p) => {
        return p.breakIn
          ? sum + Math.floor((p.breakIn.getTime() - p.breakOut.getTime()) / 60000)
          : sum;
      }, 0);
      const grossMinutes = Math.floor(
        (fin.clockOutTime.getTime() - fin.clockInTime.getTime()) / 60000,
      );
      const netWorkedMinutes = grossMinutes - totalBreakMinutes;

      // حساب lateMinutes / earlyLeaveMinutes من جدول الدوام
      const { lateMinutes, earlyLeaveMinutes } = await this.calcScheduleDeltas(
        employeeId, dateStr, fin.clockInTime, fin.clockOutTime, tx,
      );

      await tx.$executeRaw`
        UPDATE attendance.attendance_records
        SET "workedMinutes"       = ${grossMinutes},
            "totalBreakMinutes"   = ${totalBreakMinutes},
            "netWorkedMinutes"    = ${netWorkedMinutes},
            "lateMinutes"         = ${lateMinutes},
            "earlyLeaveMinutes"   = ${earlyLeaveMinutes},
            "updatedAt"           = NOW()
        WHERE id = ${recordId}
      `;
    }
  }

  /**
   * يحسب lateMinutes و earlyLeaveMinutes بناءً على جدول الدوام المخصص للموظف
   */
  private async calcScheduleDeltas(
    employeeId: string,
    dateStr: string,
    clockInTime: Date,
    clockOutTime: Date,
    tx: any,
  ): Promise<{ lateMinutes: number; earlyLeaveMinutes: number }> {
    const schedules = await tx.$queryRaw<Array<{
      workStartTime: string;
      workEndTime: string;
      lateToleranceMin: number;
      earlyLeaveToleranceMin: number;
    }>>`
      SELECT ws."workStartTime", ws."workEndTime",
             ws."lateToleranceMin", ws."earlyLeaveToleranceMin"
      FROM attendance.employee_schedules es
      JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
      WHERE es."employeeId" = ${employeeId}
        AND ${dateStr}::date BETWEEN es."effectiveFrom"::date
            AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)
        AND es."isActive" = true
      LIMIT 1
    `;

    if (!schedules[0]) return { lateMinutes: 0, earlyLeaveMinutes: 0 };

    const s = schedules[0];
    const [startH, startM] = s.workStartTime.split(':').map(Number);
    const [endH, endM] = s.workEndTime.split(':').map(Number);

    // وقت البداية المقرر بتوقيت الرياض → UTC (UTC = local - 3h)
    const scheduledStartLocal = new Date(clockInTime);
    scheduledStartLocal.setUTCHours(startH - 3, startM, 0, 0); // UTC = local - 3
    const scheduledStart = new Date(scheduledStartLocal.getTime());

    // وقت النهاية المقرر
    const scheduledEndLocal = new Date(clockOutTime);
    scheduledEndLocal.setUTCHours(endH - 3, endM, 0, 0);
    const scheduledEnd = new Date(scheduledEndLocal.getTime());

    const lateRaw = Math.floor((clockInTime.getTime() - scheduledStart.getTime()) / 60000);
    const earlyRaw = Math.floor((scheduledEnd.getTime() - clockOutTime.getTime()) / 60000);

    const lateMinutes = Math.max(0, lateRaw - (s.lateToleranceMin || 0));
    const earlyLeaveMinutes = Math.max(0, earlyRaw - (s.earlyLeaveToleranceMin || 0));

    return { lateMinutes, earlyLeaveMinutes };
  }

  /**
   * بناء أزواج BREAK_OUT → BREAK_IN من قائمة البصمات المفسرة
   */
  private buildBreakPairs(
    interpreted: Array<{ id: string; interpretedAs: InterpretedType; pairIndex: number }>,
    timestampMap: Map<string, Date>,
  ): Array<{ breakOut: Date; breakIn: Date | null }> {
    const pairs: Array<{ breakOut: Date; breakIn: Date | null }> = [];
    let current: { breakOut: Date; breakIn: Date | null } | null = null;

    for (const item of interpreted) {
      const ts = timestampMap.get(item.id);
      if (!ts) continue;

      if (item.interpretedAs === 'BREAK_OUT') {
        if (current) pairs.push(current);
        current = { breakOut: ts, breakIn: null };
      } else if (item.interpretedAs === 'BREAK_IN' && current) {
        current.breakIn = ts;
        pairs.push(current);
        current = null;
      }
    }
    if (current) pairs.push(current); // استراحة مفتوحة
    return pairs;
  }
}
