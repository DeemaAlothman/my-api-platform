import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const personalCriteria = [
  'الالتزام بموعد المقابلة',
  'المظهر الخارجي',
  'قوة الشخصية والثقة بالنفس',
  'مهارات التواصل الفعال ولغة الجسد',
  'مستوى اللغة الإنجليزية',
  'مدى معرفته بمتطلبات الشاغر ومهامه',
  'القدرة على التعامل مع المواقف (افتراض سيناريوهات)',
  'مدى معرفته بإيجابياته وسلبياته',
  'هل يوجد إنجاز عملي سابق يحسب له',
  'القدرة على العمل تحت الضغط',
  'احترامه لخصوصية وسرية عمله السابق',
  'الدورات التدريبية',
  'مدى معرفته الأساسية عن الشركة',
  'المصداقية في الإجابات',
];

const computerCriteria = [
  'Microsoft Office',
  'نظام ERP، Google Drive، أدوات الاجتماعات',
  'المراسلات والبريد الإلكتروني',
];

async function main() {
  console.log('Seeding interview criteria...');

  // Personal criteria
  for (let i = 0; i < personalCriteria.length; i++) {
    await prisma.personalCriterion.upsert({
      where: { id: `personal-${i + 1}` },
      update: {},
      create: {
        id: `personal-${i + 1}`,
        nameAr: personalCriteria[i],
        maxScore: 5,
        displayOrder: i + 1,
        isActive: true,
      },
    });
  }

  // Computer criteria
  for (let i = 0; i < computerCriteria.length; i++) {
    await prisma.computerCriterion.upsert({
      where: { id: `computer-${i + 1}` },
      update: {},
      create: {
        id: `computer-${i + 1}`,
        nameAr: computerCriteria[i],
        maxScore: 5,
        displayOrder: i + 1,
        isActive: true,
      },
    });
  }

  console.log(`✓ Seeded ${personalCriteria.length} personal criteria`);
  console.log(`✓ Seeded ${computerCriteria.length} computer criteria`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
