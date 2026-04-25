import { Injectable } from '@nestjs/common';
import { ContinuousWorkService } from './continuous-work.service';

export interface ShiftSnapshot {
  workStartTime: string;       // "HH:mm"
  workEndTime: string;         // "HH:mm"
  lateToleranceMin: number;
  earlyLeaveToleranceMin: number;
  breakDurationMin: number;
  shiftType: string;           // DAY | NIGHT | FLEXIBLE
  minimumWorkMinutes: number | null;
  requiresContinuousWork: boolean;
}

export interface PunchData {
  type: string;  // CLOCK_IN | CLOCK_OUT | BREAK_OUT | BREAK_IN
  time: Date;
}

export interface ComputedAttendance {
  status: string;
  lateMinutes: number;
  lateCompensatedMinutes: number;
  earlyLeaveMinutes: number;
  longestContinuousWorkMinutes: number;
  punchSequenceStatus: string;
}

@Injectable()
export class AttendanceComputationService {
  constructor(private readonly continuousWork: ContinuousWorkService) {}

  /**
   * الحساب الرئيسي: يحدد الحالة + التأخير + التعويض لسجل واحد.
   */
  compute(
    date: Date,
    clockIn: Date | null,
    clockOut: Date | null,
    halfDayPeriod: string | null,
    punches: PunchData[],
    schedule: ShiftSnapshot,
  ): ComputedAttendance {
    const longest = this.continuousWork.computeLongestContinuous(punches);

    // وردية مرنة (مثل وردية المحاسب 3 ساعات متواصلة)
    if (schedule.shiftType === 'FLEXIBLE' && schedule.minimumWorkMinutes) {
      const meets = this.continuousWork.meetsFlexibleRequirement(
        schedule.minimumWorkMinutes,
        longest,
      );
      return {
        status: meets ? 'PRESENT' : 'HALF_DAY',
        lateMinutes: 0,
        lateCompensatedMinutes: 0,
        earlyLeaveMinutes: meets ? 0 : schedule.minimumWorkMinutes - longest,
        longestContinuousWorkMinutes: longest,
        punchSequenceStatus: 'VALID',
      };
    }

    // وردية كلاسيكية
    if (!clockIn) {
      return {
        status: 'ABSENT',
        lateMinutes: 0,
        lateCompensatedMinutes: 0,
        earlyLeaveMinutes: 0,
        longestContinuousWorkMinutes: 0,
        punchSequenceStatus: 'PARTIAL',
      };
    }

    const shiftStart = this.parseShiftTime(date, schedule.workStartTime, halfDayPeriod, 'start', schedule);
    const shiftEnd = this.parseShiftTime(date, schedule.workEndTime, halfDayPeriod, 'end', schedule);

    const { lateMinutes, lateCompensatedMinutes } = this.computeLatenessAndCompensation(
      clockIn,
      clockOut,
      shiftStart,
      shiftEnd,
      schedule.lateToleranceMin,
    );

    const earlyLeaveMinutes = clockOut && clockOut < shiftEnd
      ? Math.max(0, Math.floor((shiftEnd.getTime() - clockOut.getTime()) / 60000) - schedule.earlyLeaveToleranceMin)
      : 0;

    let status = 'PRESENT';
    if (lateMinutes > 0 && earlyLeaveMinutes > 0) status = 'LATE';
    else if (lateMinutes > 0) status = 'LATE';
    else if (earlyLeaveMinutes > 0) status = 'EARLY_LEAVE';

    return {
      status,
      lateMinutes,
      lateCompensatedMinutes,
      earlyLeaveMinutes,
      longestContinuousWorkMinutes: longest,
      punchSequenceStatus: clockOut ? 'VALID' : 'PARTIAL',
    };
  }

  /**
   * حساب التأخير اليومي + دقائق التعويض (خروج بعد وقت الدوام يعوّض عن التأخير).
   */
  computeLatenessAndCompensation(
    clockIn: Date,
    clockOut: Date | null,
    shiftStart: Date,
    shiftEnd: Date,
    lateToleranceMin: number,
  ): { lateMinutes: number; lateCompensatedMinutes: number } {
    const lateRaw = Math.max(0, Math.floor((clockIn.getTime() - shiftStart.getTime()) / 60000));
    const lateAfterTolerance = Math.max(0, lateRaw - lateToleranceMin);

    let compensation = 0;
    if (clockOut && clockOut > shiftEnd && lateAfterTolerance > 0) {
      const excess = Math.floor((clockOut.getTime() - shiftEnd.getTime()) / 60000);
      compensation = Math.min(excess, lateAfterTolerance);
    }

    return { lateMinutes: lateAfterTolerance, lateCompensatedMinutes: compensation };
  }

  /**
   * وقت بداية/نهاية الوردية الفعلي مع مراعاة نصف اليوم.
   */
  private parseShiftTime(
    date: Date,
    timeStr: string,
    halfDayPeriod: string | null,
    which: 'start' | 'end',
    schedule: ShiftSnapshot,
  ): Date {
    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);

    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const startMin = toMinutes(schedule.workStartTime);
    const endMin = toMinutes(schedule.workEndTime);
    const midMin = Math.floor((startMin + endMin) / 2);

    let targetMin: number;
    if (which === 'start') {
      targetMin = halfDayPeriod === 'AM' ? midMin : startMin;
    } else {
      targetMin = halfDayPeriod === 'PM' ? midMin : endMin;
    }

    const result = new Date(day);
    result.setUTCMinutes(result.getUTCMinutes() + targetMin);
    return result;
  }
}
