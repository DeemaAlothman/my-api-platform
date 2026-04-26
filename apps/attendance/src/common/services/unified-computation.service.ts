import { Injectable } from '@nestjs/common';
import { WorkSchedulesService } from '../../work-schedules/work-schedules.service';

export interface ComputeRequest {
  employeeId: string;
  date: Date;           // بداية اليوم (setHours 0,0,0,0)
  clockInTime: Date | null;
  clockOutTime: Date | null;
  totalBreakMinutes: number;
}

export interface ComputeResult {
  status: string;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  lateCompensatedMinutes: number;
  workedMinutes: number;
  netWorkedMinutes: number;
}

@Injectable()
export class UnifiedComputationService {
  constructor(private workSchedulesService: WorkSchedulesService) {}

  async compute(req: ComputeRequest): Promise<ComputeResult> {
    const zero: ComputeResult = {
      status: req.clockInTime ? 'PRESENT' : 'ABSENT',
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      lateCompensatedMinutes: 0,
      workedMinutes: 0,
      netWorkedMinutes: 0,
    };

    // حساب workedMinutes
    if (req.clockInTime && req.clockOutTime) {
      zero.workedMinutes = Math.max(
        0,
        Math.round((req.clockOutTime.getTime() - req.clockInTime.getTime()) / 60000),
      );
    }
    zero.netWorkedMinutes = Math.max(0, zero.workedMinutes - req.totalBreakMinutes);

    const schedule = await this.workSchedulesService.getActiveScheduleForEmployee(
      req.employeeId,
      req.date,
    );
    if (!schedule) return zero;

    // تحقق من يوم العمل
    const workDays: number[] = JSON.parse(schedule.workDays);
    if (!workDays.includes(req.date.getDay())) {
      return { ...zero, status: 'WEEKEND' };
    }

    const scheduledStart = this.parseTime(req.date, schedule.workStartTime);
    let scheduledEnd   = this.parseTime(req.date, schedule.workEndTime);

    // معالجة الوردية الليلية: إذا وقت النهاية قبل البداية → النهاية في اليوم التالي
    if (scheduledEnd <= scheduledStart) {
      scheduledEnd = new Date(scheduledEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    const shiftType = (schedule as any).shiftType || 'DAY';
    const minWorkMin = (schedule as any).minimumWorkMinutes ?? null;
    const requiresContinuous = (schedule as any).requiresContinuousWork ?? false;

    // === وردية مرنة: لا تأخير ولا خروج مبكر ===
    if (shiftType === 'FLEXIBLE') {
      if (!req.clockInTime || !req.clockOutTime) {
        return { ...zero };
      }
      const checkMinutes = requiresContinuous
        ? this.longestContinuousBlock(req.clockInTime, req.clockOutTime, req.totalBreakMinutes)
        : zero.netWorkedMinutes;

      const status = (minWorkMin != null && checkMinutes < minWorkMin) ? 'EARLY_LEAVE' : 'PRESENT';
      return { ...zero, status };
    }

    // === وردية عادية (DAY / NIGHT) ===
    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;
    let lateCompensatedMinutes = 0;

    if (req.clockInTime) {
      // التأخير = (وقت الدخول الفعلي - وقت البداية) مطروحاً منه tolerance
      const lateRaw = Math.max(
        0,
        Math.round((req.clockInTime.getTime() - scheduledStart.getTime()) / 60000),
      );
      lateMinutes = Math.max(0, lateRaw - (schedule.lateToleranceMin ?? 0));
    }

    if (req.clockOutTime) {
      // الخروج المبكر = (وقت النهاية - وقت الخروج الفعلي) مطروحاً منه tolerance
      const earlyRaw = Math.max(
        0,
        Math.round((scheduledEnd.getTime() - req.clockOutTime.getTime()) / 60000),
      );
      earlyLeaveMinutes = Math.max(0, earlyRaw - (schedule.earlyLeaveToleranceMin ?? 0));

      // الأوفرتايم: الوقت بعد نهاية الوردية
      if (schedule.allowOvertime && req.clockOutTime > scheduledEnd) {
        const overtimeRaw = Math.round(
          (req.clockOutTime.getTime() - scheduledEnd.getTime()) / 60000,
        );
        overtimeMinutes = schedule.maxOvertimeHours
          ? Math.min(overtimeRaw, schedule.maxOvertimeHours * 60)
          : overtimeRaw;

        // التعويض: الخروج المتأخر يُعوّض عن التأخير الصباحي
        lateCompensatedMinutes = Math.min(overtimeRaw, lateMinutes);
      }
    }

    // تحديد الحالة — لا نكتب فوق WEEKEND
    let status = zero.status;
    if (!['WEEKEND', 'HOLIDAY', 'ON_LEAVE'].includes(status)) {
      if (lateMinutes > 0 && earlyLeaveMinutes > 0) status = 'LATE';
      else if (lateMinutes > 0) status = 'LATE';
      else if (earlyLeaveMinutes > 0) status = 'EARLY_LEAVE';
      else if (req.clockInTime) status = 'PRESENT';
      else status = 'ABSENT';
    }

    return {
      status,
      lateMinutes,
      earlyLeaveMinutes,
      overtimeMinutes,
      lateCompensatedMinutes,
      workedMinutes: zero.workedMinutes,
      netWorkedMinutes: zero.netWorkedMinutes,
    };
  }

  private parseTime(date: Date, timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const result = new Date(date);
    result.setHours(h, m, 0, 0);
    return result;
  }

  // أطول فترة عمل متواصلة (تقريب بسيط للحالة العامة)
  private longestContinuousBlock(
    clockIn: Date,
    clockOut: Date,
    totalBreakMinutes: number,
  ): number {
    return Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000) - totalBreakMinutes);
  }
}
