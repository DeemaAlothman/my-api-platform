// منطق الحساب الصافي لتقييم 360 — بلا قاعدة بيانات، قابل للاختبار مباشرة.

export type Axis = 'MANAGER' | 'CUSTOMER' | 'PEER' | 'UPWARD' | 'COMMITMENT' | 'SELF';
export type BonusTier = 'EXCEPTIONAL' | 'HIGH' | 'BASIC' | 'PIP';

// الأوزان الثابتة من الدليل (المجموع 100)
export const AXIS_WEIGHTS: Record<Axis, number> = {
  MANAGER: 40,
  CUSTOMER: 20,
  PEER: 10,
  UPWARD: 10,
  COMMITMENT: 10,
  SELF: 10,
};

export const AXES: Axis[] = ['MANAGER', 'CUSTOMER', 'PEER', 'UPWARD', 'COMMITMENT', 'SELF'];

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** نسبة تقييم واحد: مجموع الدرجات ÷ مجموع الحد الأعلى × 100 */
export function submissionPercent(answers: Array<{ score: number; maxScore: number }>): number {
  const max = answers.reduce((s, a) => s + a.maxScore, 0);
  if (max === 0) return 0;
  return round2((answers.reduce((s, a) => s + a.score, 0) / max) * 100);
}

/**
 * التطبيع: المحاور المنطبقة فقط (percent ≠ null) يُعاد توزيع أوزانها لتصبح 100.
 * مثال الدليل: فني بلا مرؤوسين ← 90 ← المدير 44.44، العملاء 22.22، والبقية 11.11.
 */
export function normalize(percents: Partial<Record<Axis, number | null>>) {
  const applicable = AXES.filter((a) => percents[a] !== null && percents[a] !== undefined);
  const available = applicable.reduce((s, a) => s + AXIS_WEIGHTS[a], 0);
  const weights: Partial<Record<Axis, number>> = {};
  let total = 0;
  for (const a of applicable) {
    const w = (AXIS_WEIGHTS[a] * 100) / available;
    weights[a] = round2(w);
    total += (w * (percents[a] as number)) / 100;
  }
  return { weights, availableWeight: available, finalScore: available > 0 ? round2(total) : null };
}

/** شرائح البونص: 90+ استثنائي، 80-89 مرتفع، 70-79 أساسي، أقل من 70 خطة تحسين */
export function bonusTier(score: number): BonusTier {
  if (score >= 90) return 'EXCEPTIONAL';
  if (score >= 80) return 'HIGH';
  if (score >= 70) return 'BASIC';
  return 'PIP';
}

export interface CommitmentSettings {
  penaltyPoints: number;
  justificationPoints: number;
  excessLeaveDayPoints: number;
  excessLeaveHourPoints: number;
  starOfMonthPoints: number;
  monthlyLeaveDaysAllowance: number;
  monthlyLeaveHoursAllowance: number;
}

export interface CommitmentInput {
  penalties: number;
  justifications: number;
  starOfMonthWins: number;
  /** مفتاح الشهر 'YYYY-MM' ← أيام الإجازة اليومية المحتسبة بهالشهر */
  leaveDaysByMonth: Record<string, number>;
  /** مفتاح الشهر 'YYYY-MM' ← ساعات الإجازة الساعية بهالشهر */
  leaveHoursByMonth: Record<string, number>;
}

/** مؤشر الالتزام: يبدأ من 10، يُخصم ويُضاف حسب أرقام HR، محصور بين 0 و 10 */
export function commitmentScore(input: CommitmentInput, s: CommitmentSettings) {
  const excessDays = Object.values(input.leaveDaysByMonth)
    .reduce((sum, d) => sum + Math.max(0, d - s.monthlyLeaveDaysAllowance), 0);
  const excessHours = Object.values(input.leaveHoursByMonth)
    .reduce((sum, h) => sum + Math.max(0, h - s.monthlyLeaveHoursAllowance), 0);

  const deductions = {
    penalties: input.penalties * s.penaltyPoints,
    justifications: input.justifications * s.justificationPoints,
    excessLeaveDays: excessDays * s.excessLeaveDayPoints,
    excessLeaveHours: excessHours * s.excessLeaveHourPoints,
  };
  const bonus = input.starOfMonthWins * s.starOfMonthPoints;
  const raw = 10 - Object.values(deductions).reduce((a, b) => a + b, 0) + bonus;
  const score = round2(Math.min(10, Math.max(0, raw)));

  return {
    score,                    // من 10
    percent: round2(score * 10),
    excessLeaveDays: round2(excessDays),
    excessLeaveHours: round2(excessHours),
    deductions: Object.fromEntries(Object.entries(deductions).map(([k, v]) => [k, round2(v)])),
    bonus: round2(bonus),
  };
}

/** متوسط تقييمات 1-5 ← نسبة مئوية (4.4 ← 88%) */
export function ratingToPercent(avgRating: number): number {
  return round2((avgRating / 5) * 100);
}
