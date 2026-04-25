import { Injectable } from '@nestjs/common';

@Injectable()
export class ContinuousWorkService {
  /**
   * أطول فترة عمل متواصلة بالدقائق من تسلسل البصمات.
   * "متواصلة" = بدون انقطاع بين CLOCK_IN/BREAK_IN و CLOCK_OUT/BREAK_OUT.
   */
  computeLongestContinuous(punches: { time: Date; type: string }[]): number {
    if (punches.length < 2) return 0;

    let longest = 0;
    let segmentStart: Date | null = null;

    for (const punch of punches) {
      if (punch.type === 'CLOCK_IN' || punch.type === 'BREAK_IN') {
        segmentStart = punch.time;
      } else if ((punch.type === 'CLOCK_OUT' || punch.type === 'BREAK_OUT') && segmentStart) {
        const minutes = (punch.time.getTime() - segmentStart.getTime()) / 60000;
        if (minutes > longest) longest = minutes;
        segmentStart = null;
      }
    }

    return Math.floor(longest);
  }

  /**
   * هل حقق الموظف متطلب الوردية المرنة (مثل 3 ساعات متواصلة للمحاسب).
   */
  meetsFlexibleRequirement(
    minimumWorkMinutes: number | null,
    longestContinuous: number,
  ): boolean {
    if (!minimumWorkMinutes) return true;
    return longestContinuous >= minimumWorkMinutes;
  }
}
