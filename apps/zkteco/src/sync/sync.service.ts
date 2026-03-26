import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    try {
      // 1. جلب كل بصمات هالموظف لهاليوم مرتبة بالوقت
      const startOfDay = new Date(timestamp);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(timestamp);
      endOfDay.setHours(23, 59, 59, 999);

      const todayLogs = await this.prisma.rawAttendanceLog.findMany({
        where: {
          employeeId,
          timestamp: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { timestamp: 'asc' },
      });

      if (todayLogs.length === 0) return;

      // 2. تصفية البصمات المتكررة (أقل من دقيقتين)
      const filteredLogs = this.filterDuplicates(todayLogs);

      // 3. تطبيق Toggle Logic
      const interpreted = this.applyToggleLogic(filteredLogs);

      // 4. تحديث interpretedAs و pairIndex لكل سجل
      for (const item of interpreted) {
        await this.prisma.rawAttendanceLog.update({
          where: { id: item.id },
          data: {
            interpretedAs: item.interpretedAs,
            pairIndex: item.pairIndex,
          },
        });
      }

      // 5. كتابة للـ attendance schema
      await this.writeToAttendance(employeeId, timestamp, interpreted);

      // 6. وضع علامة synced على السجل الجديد
      await this.prisma.rawAttendanceLog.update({
        where: { id: logId },
        data: { synced: true, syncedAt: new Date() },
      });

    } catch (error) {
      this.logger.error(`Error processing stamp logId=${logId}: ${error.message}`);
      await this.prisma.rawAttendanceLog.update({
        where: { id: logId },
        data: { syncError: error.message },
      }).catch(() => {});
    }
  }

  /**
   * تصفية البصمات المتكررة (أقل من دقيقتين بين بصمتين)
   */
  private filterDuplicates(logs: any[]): any[] {
    const filtered: any[] = [];
    for (const log of logs) {
      if (filtered.length === 0) {
        filtered.push(log);
        continue;
      }
      const last = filtered[filtered.length - 1];
      const diffMs = log.timestamp.getTime() - last.timestamp.getTime();
      if (diffMs >= 2 * 60 * 1000) { // 2 دقائق
        filtered.push(log);
      }
      // else: تجاهل البصمة المتكررة
    }
    return filtered;
  }

  /**
   * تطبيق Toggle Logic:
   * N=1: [CLOCK_IN]
   * N=2: [CLOCK_IN, CLOCK_OUT]
   * N>=3: [CLOCK_IN, BREAK_OUT/BREAK_IN alternating, CLOCK_OUT]
   */
  private applyToggleLogic(logs: any[]): Array<{ id: string; interpretedAs: InterpretedType; pairIndex: number }> {
    const n = logs.length;

    return logs.map((log, index) => {
      let interpretedAs: InterpretedType;

      if (index === 0) {
        interpretedAs = 'CLOCK_IN';
      } else if (n === 2 && index === 1) {
        interpretedAs = 'CLOCK_OUT';
      } else if (index === n - 1) {
        // آخر بصمة = خروج نهائي
        interpretedAs = 'CLOCK_OUT';
      } else {
        // بصمات وسطية: تتبادل BREAK_OUT / BREAK_IN
        // index 1 = BREAK_OUT, index 2 = BREAK_IN, index 3 = BREAK_OUT, ...
        interpretedAs = index % 2 === 1 ? 'BREAK_OUT' : 'BREAK_IN';
      }

      return { id: log.id, interpretedAs, pairIndex: index + 1 };
    });
  }

  /**
   * كتابة النتائج لـ attendance.attendance_records (Option B - Direct DB write)
   */
  private async writeToAttendance(
    employeeId: string,
    timestamp: Date,
    interpreted: Array<{ id: string; interpretedAs: InterpretedType; pairIndex: number }>,
  ) {
    const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD

    // جلب اليوم الحالي من attendance schema
    const records = await this.prisma.$queryRaw<Array<{
      id: string;
      clockInTime: Date | null;
      clockOutTime: Date | null;
    }>>`
      SELECT id, "clockInTime", "clockOutTime"
      FROM attendance.attendance_records
      WHERE "employeeId" = ${employeeId}
        AND date = ${dateStr}::date
      LIMIT 1
    `;

    const existingRecord = records[0] ?? null;

    // جلب timestamps للبصمات المفسرة
    const logIds = interpreted.map(i => i.id);
    const rawLogs = await this.prisma.rawAttendanceLog.findMany({
      where: { id: { in: logIds } },
      select: { id: true, timestamp: true },
    });
    const timestampMap = new Map(rawLogs.map(l => [l.id, l.timestamp]));

    const clockInItem = interpreted.find(i => i.interpretedAs === 'CLOCK_IN');
    const clockOutItem = [...interpreted].reverse().find(i => i.interpretedAs === 'CLOCK_OUT');

    const clockInTime = clockInItem ? timestampMap.get(clockInItem.id) : null;
    const clockOutTime = clockOutItem ? timestampMap.get(clockOutItem.id) : null;

    if (!existingRecord) {
      // إنشاء سجل جديد
      if (clockInTime) {
        await this.prisma.$executeRaw`
          INSERT INTO attendance.attendance_records
            (id, "employeeId", date, "clockInTime", "clockOutTime", status, "isManualEntry", "lateMinutes", "earlyLeaveMinutes", "deductionApplied", "createdAt", "updatedAt")
          VALUES
            (gen_random_uuid(), ${employeeId}, ${dateStr}::date, ${clockInTime}, ${clockOutTime ?? null},
             'PRESENT', false, 0, 0, false, NOW(), NOW())
          ON CONFLICT ("employeeId", date) DO NOTHING
        `;
      }
    } else {
      // تحديث السجل الموجود
      const updates: string[] = [];

      if (clockInTime && !existingRecord.clockInTime) {
        await this.prisma.$executeRaw`
          UPDATE attendance.attendance_records
          SET "clockInTime" = ${clockInTime}, "updatedAt" = NOW()
          WHERE id = ${existingRecord.id}
        `;
      }

      if (clockOutTime) {
        // احسب workedMinutes
        const inTime = existingRecord.clockInTime ?? clockInTime;
        let workedMinutes: number | null = null;
        if (inTime && clockOutTime) {
          workedMinutes = Math.floor((clockOutTime.getTime() - inTime.getTime()) / 60000);
        }

        await this.prisma.$executeRaw`
          UPDATE attendance.attendance_records
          SET "clockOutTime" = ${clockOutTime},
              "workedMinutes" = ${workedMinutes},
              "updatedAt" = NOW()
          WHERE id = ${existingRecord.id}
        `;
      }
    }
  }
}
