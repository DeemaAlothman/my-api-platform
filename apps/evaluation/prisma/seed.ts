import { PrismaClient, CriteriaCategory, PeriodStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create Evaluation Criteria
  const criteria = [
    // PERFORMANCE (الأداء الوظيفي)
    {
      code: 'PERF_001',
      nameAr: 'جودة العمل',
      nameEn: 'Quality of Work',
      descriptionAr: 'مستوى الدقة والإتقان في إنجاز المهام',
      descriptionEn: 'Level of accuracy and excellence in completing tasks',
      weight: 1.5,
      maxScore: 5,
      category: 'PERFORMANCE' as CriteriaCategory,
      displayOrder: 1,
    },
    {
      code: 'PERF_002',
      nameAr: 'الإنتاجية',
      nameEn: 'Productivity',
      descriptionAr: 'كمية العمل المنجز خلال الفترة الزمنية المحددة',
      descriptionEn: 'Amount of work completed within the specified time period',
      weight: 1.5,
      maxScore: 5,
      category: 'PERFORMANCE' as CriteriaCategory,
      displayOrder: 2,
    },
    {
      code: 'PERF_003',
      nameAr: 'الالتزام بالمواعيد',
      nameEn: 'Timeliness',
      descriptionAr: 'القدرة على إنجاز المهام في الوقت المحدد',
      descriptionEn: 'Ability to complete tasks on time',
      weight: 1.0,
      maxScore: 5,
      category: 'PERFORMANCE' as CriteriaCategory,
      displayOrder: 3,
    },

    // BEHAVIOR (السلوك المهني)
    {
      code: 'BEH_001',
      nameAr: 'الانضباط الوظيفي',
      nameEn: 'Work Discipline',
      descriptionAr: 'الالتزام بمواعيد العمل والسياسات المؤسسية',
      descriptionEn: 'Adherence to work schedules and organizational policies',
      weight: 1.0,
      maxScore: 5,
      category: 'BEHAVIOR' as CriteriaCategory,
      displayOrder: 4,
    },
    {
      code: 'BEH_002',
      nameAr: 'التعاون مع الفريق',
      nameEn: 'Teamwork',
      descriptionAr: 'القدرة على العمل ضمن فريق والتفاعل مع الزملاء',
      descriptionEn: 'Ability to work within a team and interact with colleagues',
      weight: 1.2,
      maxScore: 5,
      category: 'BEHAVIOR' as CriteriaCategory,
      displayOrder: 5,
    },
    {
      code: 'BEH_003',
      nameAr: 'الاحترافية',
      nameEn: 'Professionalism',
      descriptionAr: 'السلوك المهني والأخلاقيات في العمل',
      descriptionEn: 'Professional conduct and work ethics',
      weight: 1.0,
      maxScore: 5,
      category: 'BEHAVIOR' as CriteriaCategory,
      displayOrder: 6,
    },

    // SKILLS (المهارات)
    {
      code: 'SKILL_001',
      nameAr: 'المهارات الفنية',
      nameEn: 'Technical Skills',
      descriptionAr: 'الكفاءة في استخدام الأدوات والتقنيات المطلوبة للوظيفة',
      descriptionEn: 'Proficiency in using tools and technologies required for the job',
      weight: 1.3,
      maxScore: 5,
      category: 'SKILLS' as CriteriaCategory,
      displayOrder: 7,
    },
    {
      code: 'SKILL_002',
      nameAr: 'مهارات التواصل',
      nameEn: 'Communication Skills',
      descriptionAr: 'القدرة على التواصل الفعال شفهياً وكتابياً',
      descriptionEn: 'Ability to communicate effectively verbally and in writing',
      weight: 1.0,
      maxScore: 5,
      category: 'SKILLS' as CriteriaCategory,
      displayOrder: 8,
    },

    // ACHIEVEMENT (الإنجازات)
    {
      code: 'ACH_001',
      nameAr: 'تحقيق الأهداف',
      nameEn: 'Goal Achievement',
      descriptionAr: 'نسبة تحقيق الأهداف المحددة خلال الفترة',
      descriptionEn: 'Percentage of goals achieved during the period',
      weight: 2.0,
      maxScore: 5,
      category: 'ACHIEVEMENT' as CriteriaCategory,
      displayOrder: 9,
    },
    {
      code: 'ACH_002',
      nameAr: 'المبادرة والابتكار',
      nameEn: 'Initiative and Innovation',
      descriptionAr: 'القدرة على اقتراح أفكار جديدة وتحسينات',
      descriptionEn: 'Ability to propose new ideas and improvements',
      weight: 1.2,
      maxScore: 5,
      category: 'ACHIEVEMENT' as CriteriaCategory,
      displayOrder: 10,
    },

    // DEVELOPMENT (التطوير الذاتي)
    {
      code: 'DEV_001',
      nameAr: 'التعلم والتطوير',
      nameEn: 'Learning and Development',
      descriptionAr: 'الاهتمام بالتطوير الذاتي وتعلم مهارات جديدة',
      descriptionEn: 'Interest in self-development and learning new skills',
      weight: 1.0,
      maxScore: 5,
      category: 'DEVELOPMENT' as CriteriaCategory,
      displayOrder: 11,
    },
    {
      code: 'DEV_002',
      nameAr: 'القيادة والإشراف',
      nameEn: 'Leadership and Supervision',
      descriptionAr: 'القدرة على قيادة الآخرين وتوجيههم (إن وجد)',
      descriptionEn: 'Ability to lead and guide others (if applicable)',
      weight: 1.5,
      maxScore: 5,
      category: 'DEVELOPMENT' as CriteriaCategory,
      displayOrder: 12,
    },
  ];

  console.log('Creating evaluation criteria...');
  for (const criterion of criteria) {
    await prisma.evaluationCriteria.upsert({
      where: { code: criterion.code },
      update: criterion,
      create: criterion,
    });
  }
  console.log(`Created ${criteria.length} evaluation criteria`);

  // Create Evaluation Period for 2026
  const period = {
    code: 'EVAL_2026',
    nameAr: 'دورة التقييم السنوية 2026',
    nameEn: 'Annual Evaluation Period 2026',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'DRAFT' as const,
    isActive: true,
  };

  console.log('Creating evaluation period...');
  await prisma.evaluationPeriod.upsert({
    where: { code: period.code },
    update: period,
    create: period,
  });
  console.log('Created evaluation period for 2026');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
