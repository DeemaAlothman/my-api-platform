/**
 * UTC+3 (Asia/Riyadh) timezone utilities
 * ثابت بدل date-fns-tz لتجنب إضافة dependency جديد
 */
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

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
