// صورة التمرين نفسها تصلح كصورة مصغّرة لو ما حدّد المعالج thumbnailUrl صريح (فيديو بدون thumbnail يبقى بدون صورة)
// مشترك بين مسارات المريض (/me/*) ومسارات الموقع/الداشبورد (مكتبة التمارين، عرض تمارين الجلسة)
export function withThumbnailFallback<T extends { mediaType: string; mediaUrl: string | null; thumbnailUrl: string | null }>(
  exercise: T,
): T {
  if (exercise.thumbnailUrl || exercise.mediaType !== 'IMAGE') return exercise;
  return { ...exercise, thumbnailUrl: exercise.mediaUrl };
}
