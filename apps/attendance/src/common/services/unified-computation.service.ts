import { Injectable } from '@nestjs/common';
import { WorkSchedulesService } from '../../work-schedules/work-schedules.service';

export interface ComputeRequest {
  employeeId: string;
  date: Date;           // بداية اليوم (setHours 0,0,0,0)
  clockInTime: Date | null;
  clockOutTime: Date | null;
  totalBreakMinutes: number;
  hourlyLeaveMinutes?: number;   // دقائق الإجازة الساعية المسجلة في attendance_records
  leaveStartTime?: Date | null;  // بداية الإجازة الساعية
  leaveEndTime?: Date | null;    // نهاية الإجازة الساعية
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

    let scheduledStart = this.parseTime(req.date, schedule.workStartTime);
    let scheduledEnd   = this.parseTime(req.date, schedule.workEndTime);

    // معالجة الوردية الليلية: إذا وقت النهاية قبل البداية → النهاية في اليوم التالي
    if (scheduledEnd <= scheduledStart) {
      scheduledEnd = new Date(scheduledEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    const shiftType = (schedule as any).shiftType || 'DAY';
    const minWorkMin = (schedule as any).minimumWorkMinutes ?? null;
    const requiresContinuous = (schedule as any).requiresContinuousWork ?? false;

    // إصلاح 0.2: تعديل scheduledStart/scheduledEnd بناءً على الإجازة الساعية
    if (req.leaveStartTime && req.leaveEndTime) {
      if (req.leaveStartTime.getTime() <= scheduledStart.getTime() && req.leaveEndTime.getTime() > scheduledStart.getTime()) {
        scheduledStart = new Date(req.leaveEndTime);
      }
      if (req.leaveStartTime.getTime() < scheduledEnd.getTime() && req.leaveEndTime.getTime() >= scheduledEnd.getTime()) {
        scheduledEnd = new Date(req.leaveStartTime);
      }
    }

    // === وردية مرنة: لا تأخير ولا خروج مبكر ===
    if (shiftType === 'FLEXIBLE') {
      if (!req.clockInTime || !req.clockOutTime) {
        return { ...zero };
      }
      const checkMinutes = requiresContinuous
        ? this.longestContinuousBlock(req.clockInTime, req.clockOutTime, req.totalBreakMinutes)
        : zero.netWorkedMinutes;

      // إصلاح 0.5: طرح الإجازة الساعية من الحد الأدنى المطلوب
      const adjustedMinWorkMin = (minWorkMin ?? 0) - (req.hourlyLeaveMinutes ?? 0);
      const status = (adjustedMinWorkMin > 0 && checkMinutes < adjustedMinWorkMin) ? 'EARLY_LEAVE' : 'PRESENT';
      return { ...zero, status };
    }

    // === وردية عادية (DAY / NIGHT) ===
    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;
    let lateCompensatedMinutes = 0;
    let earlyArrivalMinutes = 0;

    if (req.clockInTime) {
      // التأخير = (وقت الدخول الفعلي - وقت البداية) مطروحاً منه tolerance
      const lateRaw = Math.max(
        0,
        Math.round((req.clockInTime.getTime() - scheduledStart.getTime()) / 60000),
      );
      lateMinutes = Math.max(0, lateRaw - (schedule.lateToleranceMin ?? 0));

      // الحضور المبكر: دقائق قبل بداية الوردية
      earlyArrivalMinutes = Math.max(
        0,
        Math.round((scheduledStart.getTime() - req.clockInTime.getTime()) / 60000),
      );
    }

    if (req.clockOutTime) {
      // الخروج المبكر = (وقت النهاية - وقت الخروج الفعلي) مطروحاً منه tolerance ثم مطروحاً من الحضور المبكر
      const earlyRaw = Math.max(
        0,
        Math.round((scheduledEnd.getTime() - req.clockOutTime.getTime()) / 60000),
      );
      earlyLeaveMinutes = Math.max(0, earlyRaw - (schedule.earlyLeaveToleranceMin ?? 0) - earlyArrivalMinutes);

      // إصلاح 0.5.1: الأوفرتايم بعد طرح دقائق التعويض، والتعويض فقط للتأخير ≤ 15 دقيقة
      if (schedule.allowOvertime && req.clockOutTime > scheduledEnd) {
        const excessMinutes = Math.round(
          (req.clockOutTime.getTime() - scheduledEnd.getTime()) / 60000,
        );

        if (lateMinutes > 0 && lateMinutes <= 15) {
          lateCompensatedMinutes = Math.min(excessMinutes, lateMinutes);
        }

        const overtimeAfterComp = Math.max(0, excessMinutes - lateCompensatedMinutes);
        overtimeMinutes = schedule.maxOvertimeHours
          ? Math.min(overtimeAfterComp, schedule.maxOvertimeHours * 60)
          : overtimeAfterComp;
      }
    }

    // تحديد الحالة — لا نكتب فوق WEEKEND / HOLIDAY / ON_LEAVE / PARTIAL_LEAVE / HALF_DAY
    let status = zero.status;
    if (!['WEEKEND', 'HOLIDAY', 'ON_LEAVE', 'PARTIAL_LEAVE', 'HALF_DAY'].includes(status)) {
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
