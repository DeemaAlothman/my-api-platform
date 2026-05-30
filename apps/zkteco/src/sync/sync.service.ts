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

    this.logger.log(
      `[STAMP_START] logId=${logId} employeeId=${employeeId} deviceSN=${deviceSN} timestamp=${timestamp.toISOString()} date=${dateStr}`,
    );

    // 3.3: نستعلم عن shiftType خارج الـ transaction لتجنب إلغاءها عند فشل الاستعلام
    const shiftType = await this.getEmployeeShiftType(employeeId, dateStr, this.prisma);
    this.logger.log(`[SHIFT_TYPE] employeeId=${employeeId} date=${dateStr} resolvedShiftType=${shiftType}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        // advisory lock: يمنع race condition لنفس الموظف + اليوم
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

        // 1. جلب بصمات اليوم بناءً على نوع الوردية
        const { start: startOfDay, end: endOfDay } = shiftDayRange(timestamp, shiftType);

        const todayLogs = await tx.rawAttendanceLog.findMany({
          where: {
            employeeId,
            timestamp: { gte: startOfDay, lte: endOfDay },
          },
          orderBy: { timestamp: 'asc' },
        });

        this.logger.log(
          `[STAMPS_FOUND] employeeId=${employeeId} date=${dateStr} totalStamps=${todayLogs.length} window=${startOfDay.toISOString()}→${endOfDay.toISOString()}`,
        );

        if (todayLogs.length === 0) {
          this.logger.warn(`[STAMPS_EMPTY] employeeId=${employeeId} date=${dateStr} logId=${logId} — no stamps in window, skipping`);
          return;
        }

        // 2. تصفية البصمات المكررة (أقل من دقيقتين) وتعليمها
        const { kept: filteredLogs, duplicates: duplicateIds } = this.filterDuplicates(todayLogs);
        if (duplicateIds.length > 0) {
          this.logger.log(
            `[DUPLICATES] employeeId=${employeeId} date=${dateStr} duplicatesRemoved=${duplicateIds.length} kept=${filteredLogs.length}`,
          );
          await tx.rawAttendanceLog.updateMany({
            where: { id: { in: duplicateIds } },
            data: { interpretedAs: 'DUPLICATE_IGNORED' },
          });
        }

        // 3. تطبيق Toggle Logic
        const interpreted = this.applyToggleLogic(filteredLogs);

        const withErrors = interpreted.filter(i => i.syncError);
        if (withErrors.length > 0) {
          this.logger.warn(
            `[TOGGLE_WARN] employeeId=${employeeId} date=${dateStr} stampsWithConflict=${withErrors.length} errors=${withErrors.map(i => i.syncError).join(' | ')}`,
          );
        }
        this.logger.log(
          `[TOGGLE_RESULT] employeeId=${employeeId} date=${dateStr} sequence=${interpreted.map(i => i.interpretedAs).join('→')}`,
        );

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
        await this.writeToAttendance(employeeId, timestamp, interpreted, deviceSN, tx);

        // 6. وضع علامة synced على السجل الجديد
        await tx.rawAttendanceLog.update({
          where: { id: logId },
          data: { synced: true, syncedAt: new Date() },
        });

        this.logger.log(`[STAMP_DONE] logId=${logId} employeeId=${employeeId} date=${dateStr} — synced successfully`);
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[STAMP_ERROR] logId=${logId} employeeId=${employeeId} deviceSN=${deviceSN} date=${dateStr} — ${msg}`,
        error instanceof Error ? error.stack : undefined,
      );
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
        ORDER BY es."effectiveFrom" DESC
        LIMIT 1
      `;
      const val = rows[0]?.shiftType;
      if (!rows[0]) {
        this.logger.warn(
          `[NO_SCHEDULE] employeeId=${employeeId} date=${dateStr} — no active employee_schedule found, defaulting to DAY shift`,
        );
        return 'DAY';
      }
      return val === 'NIGHT' ? 'NIGHT' : 'DAY';
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[SCHEDULE_QUERY_FAILED] employeeId=${employeeId} date=${dateStr} — ${msg}, defaulting to DAY shift`,
      );
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
      if (diffMs >= 5 * 60 * 1000) { // 5 دقائق
        kept.push(log);
      } else {
        duplicates.push(log.id); // تعليم كـ DUPLICATE_IGNORED
      }
    }
    return { kept, duplicates };
  }

  /**
   * Phase 1.2: اكتشف إذا الجهاز يبعت rawType مفيد (قيم مختلفة) → استخدم rawType مباشرة
   * وإلا → applyOrderBasedToggle (Toggle Logic الموجود + Phase 1.3)
   */
  private applyToggleLogic(
    logs: any[],
  ): Array<{ id: string; interpretedAs: InterpretedType; pairIndex: number; syncError?: string }> {
    const allRawTypes = logs.map(l => l.rawType).filter(t => t !== undefined && t !== null);
    const uniqueRawTypes = new Set(allRawTypes);
    const hasMeaningfulRawType = allRawTypes.length === logs.length && uniqueRawTypes.size > 1;

    if (hasMeaningfulRawType) {
      this.logger.log(`[RAWTYPE_MODE] Using rawType-based interpretation (uniqueTypes=${[...uniqueRawTypes].join(',')})`);
      return this.applyRawTypeLogic(logs);
    }
    return this.applyOrderBasedToggle(logs);
  }

  /** Phase 1.2: ZKTeco standard rawType: 0=CLOCK_IN, 1=CLOCK_OUT, 2=BREAK_OUT, 3=BREAK_IN */
  private applyRawTypeLogic(
    logs: any[],
  ): Array<{ id: string; interpretedAs: InterpretedType; pairIndex: number; syncError?: string }> {
    return logs.map((log, idx) => {
      let interpretedAs: InterpretedType;
      switch (log.rawType) {
        case 0: interpretedAs = 'CLOCK_IN'; break;
        case 1: interpretedAs = 'CLOCK_OUT'; break;
        case 2: interpretedAs = 'BREAK_OUT'; break;
        case 3: interpretedAs = 'BREAK_IN'; break;
        default: interpretedAs = idx === 0 ? 'CLOCK_IN' : 'CLOCK_OUT';
      }
      return { id: log.id, interpretedAs, pairIndex: idx + 1 };
    });
  }

  /**
   * Phase 1.3: Toggle Logic بالترتيب مع معالجة البصمات الفردية
   * إذا n فردي وآخر فجوة > 240 دقيقة → البصمة الأخيرة ضالة (stray)، اعتمد ما قبلها كـ CLOCK_OUT
   * بصمتان فجوتهما < 15 دقيقة → تُعامل كبصمة واحدة (CLOCK_IN فقط)
   */
  private applyOrderBasedToggle(
    logs: any[],
  ): Array<{ id: string; interpretedAs: InterpretedType; pairIndex: number; syncError?: string }> {
    const n = logs.length;

    // بصمتان متلاصقتان < 15 دقيقة → تُعامل كبصمة وحيدة (دخول فقط)
    if (n === 2) {
      const gapMinutes = (logs[1].timestamp.getTime() - logs[0].timestamp.getTime()) / 60000;
      if (gapMinutes < 15) {
        const warn = `two stamps ${Math.round(gapMinutes)}min apart — treated as single CLOCK_IN (< 15min)`;
        this.logger.warn(`[CLOSE_STAMPS] ${warn}`);
        return [
          { id: logs[0].id, interpretedAs: 'CLOCK_IN' as InterpretedType, pairIndex: 1 },
          { id: logs[1].id, interpretedAs: 'CLOCK_IN' as InterpretedType, pairIndex: 2, syncError: warn },
        ];
      }
    }

    let effectiveLogs = logs;
    let strayStampId: string | undefined;
    let strayWarning: string | undefined;

    if (n >= 3 && n % 2 === 1) {
      const last = logs[n - 1];
      const prev = logs[n - 2];
      const gapMinutes = (last.timestamp.getTime() - prev.timestamp.getTime()) / 60000;
      if (gapMinutes > 240) {
        effectiveLogs = logs.slice(0, n - 1);
        strayStampId = last.id;
        strayWarning = `odd stamp count (n=${n}), last stamp gap=${Math.round(gapMinutes)}min > 240 — treated as stray`;
        this.logger.warn(`[STRAY_STAMP] ${strayWarning}`);
      }
    }

    const en = effectiveLogs.length;
    const result: Array<{ id: string; interpretedAs: InterpretedType; pairIndex: number; syncError?: string }> =
      effectiveLogs.map((log, index) => {
        let interpretedAs: InterpretedType;
        if (index === 0) {
          interpretedAs = 'CLOCK_IN';
        } else if (index === en - 1) {
          interpretedAs = 'CLOCK_OUT';
        } else {
          interpretedAs = index % 2 === 1 ? 'BREAK_OUT' : 'BREAK_IN';
        }
        return { id: log.id, interpretedAs, pairIndex: index + 1, syncError: undefined as string | undefined };
      });

    // أضف البصمة الضالة مع syncError
    if (strayStampId && strayWarning) {
      result.push({ id: strayStampId, interpretedAs: 'CLOCK_OUT', pairIndex: en + 1, syncError: strayWarning });
    }

    // rawType conflict في آخر بصمتين (بدون حالة stray)
    if (!strayWarning && n >= 2) {
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
    deviceSN: string,
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
           source, "deviceSN", "clockInDeviceSN", "createdAt", "updatedAt")
        VALUES
          (gen_random_uuid(), ${employeeId}, ${dateStr}::date, ${clockInTime}, ${clockOutTime ?? null},
           'PRESENT', false, 0, 0, false,
           'BIOMETRIC', ${deviceSN}, ${deviceSN}, NOW(), NOW())
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
        // إذا كانت الحالة ABSENT → تحديثها لـ PRESENT فوراً عند وصول أول بصمة
        const PROTECTED = ['ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'PARTIAL_LEAVE', 'HALF_DAY'];
        const statusRow = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT status FROM attendance.attendance_records WHERE id = ${recordId}
        `;
        if (statusRow[0] && !PROTECTED.includes(statusRow[0].status)) {
          await tx.$executeRaw`
            UPDATE attendance.attendance_records SET status = 'PRESENT', "updatedAt" = NOW()
            WHERE id = ${recordId}
          `;
        }
      }
      if (clockOutTime) {
        await tx.$executeRaw`
          UPDATE attendance.attendance_records
          SET "clockOutTime" = ${clockOutTime}, "clockOutDeviceSN" = ${deviceSN}, "updatedAt" = NOW()
          WHERE id = ${recordId}
        `;
      }
    }

    if (!recordId) return;

    // تسجيل audit عند إنشاء سجل جديد أو تسجيل خروج
    if (!existing[0]) {
      await this.auditLog(tx, recordId, employeeId, dateStr, 'BIOMETRIC_CLOCK_IN', deviceSN,
        `تسجيل دخول بيومتري: ${clockInTime?.toISOString()}`);
    } else if (clockOutTime) {
      await this.auditLog(tx, recordId, employeeId, dateStr, 'BIOMETRIC_CLOCK_OUT', deviceSN,
        `تسجيل خروج بيومتري: ${clockOutTime.toISOString()}`);
    }

    // حساب أزواج الاستراحات وكتابتها
    const breakPairs = this.buildBreakPairs(interpreted, timestampMap as Map<string, Date>);

    // جلب الاستراحات الموجودة للحفاظ على reason/isAuthorized المدخلة يدوياً
    const existingBreaks = await tx.$queryRaw<Array<{ id: string; breakOut: Date }>>`
      SELECT id, "breakOut" FROM attendance.attendance_breaks WHERE "attendanceRecordId" = ${recordId}
    `;
    const existingByBreakOut = new Map<number, string>(
      existingBreaks.map((b: { id: string; breakOut: Date }) => [b.breakOut.getTime(), b.id]),
    );

    for (const pair of breakPairs) {
      const duration = pair.breakIn
        ? Math.floor((pair.breakIn.getTime() - pair.breakOut.getTime()) / 60000)
        : null;
      const existingId = existingByBreakOut.get(pair.breakOut.getTime());

      if (existingId) {
        // تحديث التوقيت فقط — الحفاظ على reason/isAuthorized
        await tx.$executeRaw`
          UPDATE attendance.attendance_breaks
          SET "breakIn"         = ${pair.breakIn ?? null},
              "durationMinutes" = ${duration},
              "updatedAt"       = NOW()
          WHERE id = ${existingId}
        `;
      } else {
        // استراحة جديدة من البصمة
        await tx.$executeRaw`
          INSERT INTO attendance.attendance_breaks
            (id, "attendanceRecordId", "breakOut", "breakIn", "durationMinutes", "createdAt", "updatedAt")
          VALUES
            (gen_random_uuid(), ${recordId}, ${pair.breakOut}, ${pair.breakIn ?? null}, ${duration}, NOW(), NOW())
        `;
      }
    }

    // تحديث workedMinutes / totalBreakMinutes / netWorkedMinutes
    const finalRecord = await tx.$queryRaw<Array<{ clockInTime: Date | null; clockOutTime: Date | null }>>`
      SELECT "clockInTime", "clockOutTime" FROM attendance.attendance_records WHERE id = ${recordId}
    `;

    const fin = finalRecord[0];

    // حساب punchSequenceStatus بناءً على البصمات المفسرة
    const hasSyncError = interpreted.some(i => (i as any).syncError);
    const stampCount = interpreted.length;
    const anyLongBreak = breakPairs.some(b =>
      b.breakIn && (b.breakIn.getTime() - b.breakOut.getTime()) > 240 * 60 * 1000,
    );
    const isNeedsReview =
      hasSyncError ||
      (stampCount % 2 === 1 && stampCount >= 3) ||
      anyLongBreak ||
      stampCount > 8 ||
      (fin?.clockInTime && fin?.clockOutTime &&
        fin.clockOutTime.getTime() - fin.clockInTime.getTime() > 16 * 60 * 60 * 1000);

    const punchSequenceStatus = !fin?.clockOutTime ? 'PARTIAL'
      : isNeedsReview ? 'NEEDS_REVIEW'
      : hasSyncError ? 'INVALID'
      : 'VALID';

    // تحديث punchSequenceStatus فوراً (حتى لو لم يكتمل الزوج بعد)
    await tx.$executeRaw`
      UPDATE attendance.attendance_records
      SET "punchSequenceStatus" = ${punchSequenceStatus},
          "updatedAt"           = NOW()
      WHERE id = ${recordId}
    `;

    if (fin?.clockInTime && fin?.clockOutTime) {
      const totalBreakMinutes = breakPairs.reduce((sum, p) => {
        return p.breakIn
          ? sum + Math.floor((p.breakIn.getTime() - p.breakOut.getTime()) / 60000)
          : sum;
      }, 0);
      const grossMinutes = Math.floor(
        (fin.clockOutTime.getTime() - fin.clockInTime.getTime()) / 60000,
      );

      // جلب ساعات الإجازة الساعية للتقاطع مع ساعات العمل (Fix 0.2/0.3)
      const leaveRow = await tx.$queryRaw<Array<{
        leaveStartTime: Date | null;
        leaveEndTime: Date | null;
        hourlyLeaveMinutes: number | null;
      }>>`
        SELECT "leaveStartTime", "leaveEndTime", "hourlyLeaveMinutes"
        FROM attendance.attendance_records
        WHERE id = ${recordId}
        LIMIT 1
      `;
      const leaveStart = leaveRow[0]?.leaveStartTime ?? null;
      const leaveEnd   = leaveRow[0]?.leaveEndTime   ?? null;
      const hourlyLeaveMinutesDB = leaveRow[0]?.hourlyLeaveMinutes ?? 0;

      // طرح الإجازة الساعية المتقاطعة مع ساعات العمل من الوقت الفعلي
      let hourlyLeaveInWorkday = 0;
      if (leaveStart && leaveEnd) {
        const overlapStart = Math.max(leaveStart.getTime(), fin.clockInTime.getTime());
        const overlapEnd   = Math.min(leaveEnd.getTime(),   fin.clockOutTime.getTime());
        if (overlapEnd > overlapStart) {
          hourlyLeaveInWorkday = Math.floor((overlapEnd - overlapStart) / 60000);
        }
      }
      const netWorkedMinutes = grossMinutes - totalBreakMinutes - hourlyLeaveInWorkday;

      // حساب lateMinutes / earlyLeaveMinutes / overtimeMinutes والحقول الجديدة من جدول الدوام
      const {
        lateMinutes, earlyLeaveMinutes, overtimeMinutes,
        lateCompensatedMinutes, shiftType, minimumWorkMinutes, requiresContinuousWork,
      } = await this.calcScheduleDeltas(
        employeeId, dateStr, fin.clockInTime, fin.clockOutTime, tx, leaveStart, leaveEnd,
      );

      // حساب longestContinuousWorkMinutes (لورديات FLEXIBLE)
      const longestContinuousWorkMinutes = this.computeLongestContinuous(
        fin.clockInTime, fin.clockOutTime, breakPairs,
      );

      // للوردية المرنة (FLEXIBLE): التأخير والخروج المبكر لا تُطبَّق
      const effectiveLateMinutes = shiftType === 'FLEXIBLE' ? 0 : lateMinutes;
      const effectiveEarlyLeaveMinutes = shiftType === 'FLEXIBLE' ? 0 : earlyLeaveMinutes;

      // تحديد الحالة النهائية — لا نكتب فوق ON_LEAVE/HOLIDAY/WEEKEND/PARTIAL_LEAVE/HALF_DAY
      // ABSENT: يُسمح بالتحديث عند وصول بصمة فعلية (الموظف جاء متأخراً)
      const currentStatusRow = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM attendance.attendance_records WHERE id = ${recordId}
      `;
      const currentStatus = currentStatusRow[0]?.status ?? 'PRESENT';
      const PROTECTED_STATUSES = ['ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'PARTIAL_LEAVE', 'HALF_DAY'];
      let newStatus = currentStatus;
      if (!PROTECTED_STATUSES.includes(currentStatus)) {
        if (shiftType === 'FLEXIBLE') {
          // للوردية المرنة: الحضور يُحسب بعدد الساعات مع طرح الإجازة الساعية من الحد الأدنى
          const checkMinutes = requiresContinuousWork ? longestContinuousWorkMinutes : netWorkedMinutes;
          const adjustedMinWorkMin = (minimumWorkMinutes ?? 0) - hourlyLeaveMinutesDB;
          newStatus = (adjustedMinWorkMin > 0 && checkMinutes < adjustedMinWorkMin)
            ? 'EARLY_LEAVE'
            : 'PRESENT';
        } else {
          newStatus = effectiveLateMinutes > 0 ? 'LATE' : effectiveEarlyLeaveMinutes > 0 ? 'EARLY_LEAVE' : 'PRESENT';
        }
      }

      await tx.$executeRaw`
        UPDATE attendance.attendance_records
        SET "workedMinutes"                = ${grossMinutes},
            "totalBreakMinutes"            = ${totalBreakMinutes},
            "netWorkedMinutes"             = ${netWorkedMinutes},
            "lateMinutes"                  = ${effectiveLateMinutes},
            "earlyLeaveMinutes"            = ${effectiveEarlyLeaveMinutes},
            "overtimeMinutes"              = ${overtimeMinutes},
            "lateCompensatedMinutes"       = ${lateCompensatedMinutes},
            "longestContinuousWorkMinutes" = ${longestContinuousWorkMinutes},
            "punchSequenceStatus"          = ${punchSequenceStatus},
            status                         = ${newStatus},
            "updatedAt"                    = NOW()
        WHERE id = ${recordId}
      `;

      // Phase 2: إشعار المدير إذا السجل يحتاج مراجعة
      if (punchSequenceStatus === 'NEEDS_REVIEW') {
        await this.notifyManagerNeedsReview(employeeId, dateStr, tx);
      }

      await this.auditLog(tx, recordId, employeeId, dateStr, 'BIOMETRIC_COMPUTED', deviceSN,
        `حُسبت المقاييس: worked=${netWorkedMinutes}m late=${effectiveLateMinutes}m early=${effectiveEarlyLeaveMinutes}m overtime=${overtimeMinutes}m lateComp=${lateCompensatedMinutes}m longestCont=${longestContinuousWorkMinutes}m status=${newStatus} punchSeq=${punchSequenceStatus}`,
        {
          workedMinutes: { from: null, to: netWorkedMinutes },
          lateMinutes: { from: null, to: effectiveLateMinutes },
          earlyLeaveMinutes: { from: null, to: effectiveEarlyLeaveMinutes },
          overtimeMinutes: { from: null, to: overtimeMinutes },
          lateCompensatedMinutes: { from: null, to: lateCompensatedMinutes },
          longestContinuousWorkMinutes: { from: null, to: longestContinuousWorkMinutes },
          status: { from: currentStatus, to: newStatus },
        },
      );
    }
  }

  private async auditLog(
    tx: any,
    attendanceRecordId: string,
    employeeId: string,
    dateStr: string,
    action: string,
    source: string,
    notes: string,
    changedFields?: Record<string, { from: unknown; to: unknown }>,
  ) {
    try {
      await tx.$queryRawUnsafe(
        `INSERT INTO attendance.attendance_computation_logs
           (id, "attendanceRecordId", "employeeId", date, action, source,
            "changedFields", "performedBy", notes, "createdAt")
         VALUES
           (gen_random_uuid(), $1, $2, $3::date, $4, $5, $6, 'BIOMETRIC', $7, NOW())`,
        attendanceRecordId,
        employeeId,
        dateStr,
        action,
        source,
        changedFields ? JSON.stringify(changedFields) : null,
        notes,
      );
    } catch {
      // audit failure لا يوقف عملية الـ sync
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
    leaveStartTime?: Date | null,
    leaveEndTime?: Date | null,
  ): Promise<{
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    lateCompensatedMinutes: number;
    shiftType: string;
    minimumWorkMinutes: number | null;
    requiresContinuousWork: boolean;
  }> {
    const schedules = await tx.$queryRaw<Array<{
      workStartTime: string;
      workEndTime: string;
      lateToleranceMin: number;
      earlyLeaveToleranceMin: number;
      allowOvertime: boolean;
      maxOvertimeHours: number | null;
      shiftType: string | null;
      minimumWorkMinutes: number | null;
      requiresContinuousWork: boolean | null;
    }>>`
      SELECT ws."workStartTime", ws."workEndTime",
             ws."lateToleranceMin", ws."earlyLeaveToleranceMin",
             ws."allowOvertime", ws."maxOvertimeHours",
             ws."shiftType", ws."minimumWorkMinutes", ws."requiresContinuousWork"
      FROM attendance.employee_schedules es
      JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
      WHERE es."employeeId" = ${employeeId}
        AND ${dateStr}::date BETWEEN es."effectiveFrom"::date
            AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)
        AND es."isActive" = true
      ORDER BY es."effectiveFrom" DESC
      LIMIT 1
    `;

    const zero = {
      lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0,
      lateCompensatedMinutes: 0, shiftType: 'DAY',
      minimumWorkMinutes: null, requiresContinuousWork: false,
    };
    if (!schedules[0]) return zero;

    const s = schedules[0];
    const [startH, startM] = s.workStartTime.split(':').map(Number);
    const [endH, endM] = s.workEndTime.split(':').map(Number);

    // وقت البداية المقرر بتوقيت الرياض → UTC (UTC = local - 3h)
    const scheduledStartLocal = new Date(clockInTime);
    scheduledStartLocal.setUTCHours(startH - 3, startM, 0, 0);
    const scheduledStart = new Date(scheduledStartLocal.getTime());

    // وقت النهاية المقرر
    const scheduledEndLocal = new Date(clockOutTime);
    scheduledEndLocal.setUTCHours(endH - 3, endM, 0, 0);
    const scheduledEnd = new Date(scheduledEndLocal.getTime());

    // إذا كان نصف يوم، نعدّل وقت البداية/النهاية الفعّال
    const halfDayRow = await tx.$queryRaw<Array<{ halfDayPeriod: string | null }>>`
      SELECT "halfDayPeriod" FROM attendance.attendance_records
      WHERE "employeeId" = ${employeeId} AND date = ${dateStr}::date
      LIMIT 1
    `;
    const halfDayPeriod = halfDayRow[0]?.halfDayPeriod ?? null;
    if (halfDayPeriod === 'AM') {
      // الموظف إجازة الصباح — التأخير يُحسب من منتصف الوردية
      const midMs = (scheduledStart.getTime() + scheduledEnd.getTime()) / 2;
      scheduledStart.setTime(midMs);
    } else if (halfDayPeriod === 'PM') {
      // الموظف يعمل الصباح فقط — الخروج المبكر يُحسب من منتصف الوردية
      const midMs = (scheduledStart.getTime() + scheduledEnd.getTime()) / 2;
      scheduledEnd.setTime(midMs);
    }

    // إصلاح 0.2: تعديل scheduledStart/scheduledEnd بناءً على الإجازة الساعية
    let effectiveScheduledStart = new Date(scheduledStart);
    let effectiveScheduledEnd   = new Date(scheduledEnd);
    if (leaveStartTime && leaveEndTime) {
      // إذا الإجازة تغطي بداية الوردية → ابدأ التأخير من نهاية الإجازة
      if (leaveStartTime.getTime() <= scheduledStart.getTime() && leaveEndTime.getTime() > scheduledStart.getTime()) {
        effectiveScheduledStart = new Date(leaveEndTime);
      }
      // إذا الإجازة تغطي نهاية الوردية → احسب الخروج المبكر من بداية الإجازة
      if (leaveStartTime.getTime() < scheduledEnd.getTime() && leaveEndTime.getTime() >= scheduledEnd.getTime()) {
        effectiveScheduledEnd = new Date(leaveStartTime);
      }
    }

    const lateRaw = Math.floor((clockInTime.getTime() - effectiveScheduledStart.getTime()) / 60000);
    const earlyRaw = Math.floor((effectiveScheduledEnd.getTime() - clockOutTime.getTime()) / 60000);

    const lateMinutes = Math.max(0, lateRaw - (s.lateToleranceMin || 0));
    const earlyLeaveMinutes = Math.max(0, earlyRaw - (s.earlyLeaveToleranceMin || 0));

    // إصلاح 0.5.1: التعويض فقط للتأخير ≤ 15 دقيقة، والأوفرتايم بعد طرح التعويض
    const excessMinutes = Math.max(0, Math.floor((clockOutTime.getTime() - effectiveScheduledEnd.getTime()) / 60000));
    let lateCompensatedMinutes = 0;
    if (lateMinutes > 0 && lateMinutes <= 15) {
      lateCompensatedMinutes = Math.min(excessMinutes, lateMinutes);
    }

    // Overtime is always 0 at sync time — computed by daily-closure from approved requests (Section 1-ج)
    const overtimeMinutes = 0;

    return {
      lateMinutes,
      earlyLeaveMinutes,
      overtimeMinutes,
      lateCompensatedMinutes,
      shiftType: s.shiftType || 'DAY',
      minimumWorkMinutes: s.minimumWorkMinutes ?? null,
      requiresContinuousWork: s.requiresContinuousWork ?? false,
    };
  }

  /** Phase 2: إشعار المدير المباشر بأن سجل الحضور يحتاج مراجعة */
  private async notifyManagerNeedsReview(employeeId: string, dateStr: string, tx: any): Promise<void> {
    try {
      const row = await tx.$queryRaw<Array<{
        firstNameAr: string; lastNameAr: string; managerUserId: string | null;
      }>>`
        SELECT e."firstNameAr", e."lastNameAr", m."userId" AS "managerUserId"
        FROM users.employees e
        LEFT JOIN users.employees m ON m.id = e."managerId"
        WHERE e.id = ${employeeId} AND e."deletedAt" IS NULL
        LIMIT 1
      `;
      const managerUserId = row[0]?.managerUserId;
      if (!managerUserId) return;
      const empName = `${row[0].firstNameAr} ${row[0].lastNameAr}`;
      await tx.$queryRawUnsafe(
        `INSERT INTO users.notifications
           (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
         VALUES
           (gen_random_uuid(), $1, 'ATTENDANCE_NEEDS_REVIEW',
            'سجل حضور يحتاج مراجعة', 'Attendance Record Needs Review',
            $2, $3, false, NOW())`,
        managerUserId,
        `سجل حضور الموظف ${empName} يوم ${dateStr} يحتاج مراجعة يدوية`,
        `Attendance record for ${empName} on ${dateStr} requires manual review`,
      );
    } catch {
      // إشعار فاشل لا يوقف العملية
    }
  }

  /**
   * أطول فترة عمل متواصلة بالدقائق (بين بصمات الاستراحات المكتملة)
   */
  private computeLongestContinuous(
    clockIn: Date,
    clockOut: Date,
    breaks: Array<{ breakOut: Date; breakIn: Date | null }>,
  ): number {
    const completed = breaks
      .filter(b => b.breakIn !== null)
      .sort((a, b) => a.breakOut.getTime() - b.breakOut.getTime());

    if (completed.length === 0) {
      return Math.max(0, Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000));
    }

    let longest = 0;
    let segStart = clockIn;
    for (const b of completed) {
      const dur = Math.floor((b.breakOut.getTime() - segStart.getTime()) / 60000);
      if (dur > longest) longest = dur;
      segStart = b.breakIn!;
    }
    const last = Math.floor((clockOut.getTime() - segStart.getTime()) / 60000);
    if (last > longest) longest = last;
    return Math.max(0, longest);
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
