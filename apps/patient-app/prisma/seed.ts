/**
 * بيانات أولية مرجعية لخدمة patient-app (Body Regions + Skip Reasons الافتراضية من التوصيف).
 * تشغيل يدوي فقط (لا يُشغَّل تلقائياً ضمن أي migrate):
 *   cd apps/patient-app && npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BODY_REGIONS: Array<{ nameAr: string; nameEn: string; sortOrder: number }> = [
  { nameAr: 'الرقبة', nameEn: 'Neck', sortOrder: 1 },
  { nameAr: 'الكتف', nameEn: 'Shoulder', sortOrder: 2 },
  { nameAr: 'المرفق', nameEn: 'Elbow', sortOrder: 3 },
  { nameAr: 'الرسغ واليد', nameEn: 'Wrist & Hand', sortOrder: 4 },
  { nameAr: 'العمود الفقري الصدري', nameEn: 'Thoracic Spine', sortOrder: 5 },
  { nameAr: 'أسفل الظهر', nameEn: 'Lumbar Spine', sortOrder: 6 },
  { nameAr: 'الحوض والورك', nameEn: 'Hip', sortOrder: 7 },
  { nameAr: 'الركبة', nameEn: 'Knee', sortOrder: 8 },
  { nameAr: 'الكاحل', nameEn: 'Ankle', sortOrder: 9 },
  { nameAr: 'القدم', nameEn: 'Foot', sortOrder: 10 },
];

const EXERCISE_GOALS: Array<{ nameAr: string; nameEn: string }> = [
  { nameAr: 'تمارين تقوية', nameEn: 'Strengthening' },
  { nameAr: 'تمارين تمطيط', nameEn: 'Stretching' },
  { nameAr: 'تمارين زيادة المدى الحركي', nameEn: 'ROM' },
  { nameAr: 'تمارين المرونة', nameEn: 'Flexibility' },
  { nameAr: 'تمارين التوازن', nameEn: 'Balance' },
  { nameAr: 'تمارين الثبات', nameEn: 'Stability' },
  { nameAr: 'تمارين التحكم العصبي العضلي', nameEn: 'Neuromuscular Control' },
  { nameAr: 'تمارين وظيفية', nameEn: 'Functional Training' },
  { nameAr: 'تمارين التحمل', nameEn: 'Endurance' },
];

const SKIP_REASONS: Array<{ nameAr: string; nameEn: string; sortOrder: number }> = [
  { nameAr: 'ألم / انزعاج', nameEn: 'Pain/discomfort', sortOrder: 1 },
  { nameAr: 'غير قادر على التنفيذ', nameEn: 'Unable to perform', sortOrder: 2 },
  { nameAr: 'لا تتوفر أدوات', nameEn: 'No equipment', sortOrder: 3 },
  { nameAr: 'ضيق وقت', nameEn: 'Time constraint', sortOrder: 4 },
  { nameAr: 'تعليمات المعالج', nameEn: 'Therapist instruction', sortOrder: 5 },
  { nameAr: 'أخرى', nameEn: 'Other', sortOrder: 6 },
];

async function main() {
  for (const r of BODY_REGIONS) {
    await prisma.bodyRegion.upsert({
      where: { id: `seed-body-region-${r.nameEn.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: { id: `seed-body-region-${r.nameEn.toLowerCase().replace(/\s+/g, '-')}`, ...r },
    });
  }
  for (const g of EXERCISE_GOALS) {
    const existing = await prisma.exerciseGoal.findFirst({ where: { nameEn: g.nameEn } });
    if (!existing) await prisma.exerciseGoal.create({ data: g });
  }
  for (const s of SKIP_REASONS) {
    const existing = await prisma.skipReason.findFirst({ where: { nameEn: s.nameEn } });
    if (!existing) await prisma.skipReason.create({ data: s });
  }
  console.log('Seed completed: body regions, exercise goals, skip reasons.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
