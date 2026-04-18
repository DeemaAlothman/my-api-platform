/**
 * UTC+3 (Asia/Riyadh) timezone utilities
 * ثابت بدل date-fns-tz لتجنب إضافة dependency جديد
 */
export const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

/**
 * يُرجع YYYY-MM-DD بتوقيت الرياض (Asia/Riyadh)
 */
export function toLocalDateString(date: Date): string {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  return local.toISOString().split('T')[0];
}

/**
 * يُرجع بداية ونهاية اليوم بتوقيت الرياض كـ UTC timestamps
 */
export function localDayRange(date: Date): { start: Date; end: Date } {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0); // منتصف الليل بتوقيت الرياض
  const start = new Date(local.getTime() - TZ_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

/**
 * يُرجع نافذة اليوم بناءً على نوع الوردية:
 * DAY:   00:00 → 23:59 بتوقيت الرياض
 * NIGHT: 12:00 → 11:59 اليوم التالي بتوقيت الرياض (يشمل ساعات الفجر في اليوم التالي)
 */
export function shiftDayRange(
  date: Date,
  shiftType: 'DAY' | 'NIGHT',
): { start: Date; end: Date } {
  if (shiftType === 'DAY') return localDayRange(date);

  // NIGHT: نافذة من 12:00 ظهراً إلى 11:59 صباحاً اليوم التالي
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  const hour = local.getUTCHours();

  const start = new Date(local);
  // إذا البصمة قبل الظهر → تنتمي للوردية التي بدأت أمس الظهر
  if (hour < 12) start.setUTCDate(local.getUTCDate() - 1);
  start.setUTCHours(12, 0, 0, 0); // 12:00 محلي = 09:00 UTC

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    start: new Date(start.getTime() - TZ_OFFSET_MS),
    end: new Date(end.getTime() - TZ_OFFSET_MS),
  };
}
