import { Injectable } from '@nestjs/common';

// VALID | PARTIAL | INVALID | RECOMPUTED
export type PunchSequenceStatus = 'VALID' | 'PARTIAL' | 'INVALID' | 'RECOMPUTED';

@Injectable()
export class PunchValidatorService {
  /**
   * يتحقق من تسلسل البصمات ويعيد الحالة.
   * التسلسل الصحيح: [CLOCK_IN, (BREAK_OUT, BREAK_IN)*, CLOCK_OUT]
   */
  validate(punches: { type: string; time: Date }[]): PunchSequenceStatus {
    if (punches.length === 0) return 'PARTIAL';
    if (punches.length === 1 && punches[0].type === 'CLOCK_IN') return 'PARTIAL';

    // ترتيب زمني مضمون
    for (let i = 1; i < punches.length; i++) {
      if (punches[i].time < punches[i - 1].time) return 'INVALID';
    }

    if (punches[0].type !== 'CLOCK_IN') return 'INVALID';
    if (punches[punches.length - 1].type !== 'CLOCK_OUT') return 'PARTIAL';

    // فحص تناوب BREAK_OUT/BREAK_IN في الوسط
    let expectBreakOut = true;
    for (let i = 1; i < punches.length - 1; i++) {
      const expected = expectBreakOut ? 'BREAK_OUT' : 'BREAK_IN';
      if (punches[i].type !== expected) return 'INVALID';
      expectBreakOut = !expectBreakOut;
    }

    // BREAK_OUT بدون BREAK_IN مقابله
    if (!expectBreakOut) return 'INVALID';

    return 'VALID';
  }
}
