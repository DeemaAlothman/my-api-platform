/**
 * seed-demo.ts — بيانات تجريبية للتقييم
 * يفترض إن evaluation/seed.ts شغّل قبله (لإنشاء المعايير والدورة)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// نفس IDs من users/seed-demo.ts
const EMP = {
  sarah:  'e0000001-0000-0000-0000-000000000000',
  khalid: 'e0000002-0000-0000-0000-000000000000',
  fatima: 'e0000003-0000-0000-0000-000000000000',
  omar:   'e0000004-0000-0000-0000-000000000000',
  nora:   'e0000005-0000-0000-0000-000000000000',
};

// IDs ثابتة للنماذج
const FORM = {
  fatima: 'ef000001-0000-0000-0000-000000000000',
  omar:   'ef000002-0000-0000-0000-000000000000',
  nora:   'ef000003-0000-0000-0000-000000000000',
};

async function main() {
  console.log('🌱 Seeding demo evaluation data...');

  // جيب دورة التقييم
  const period = await prisma.evaluationPeriod.findUnique({ where: { code: 'EVAL_2026' } });
  if (!period) {
    console.error('❌ Run the base evaluation seed first (npx tsx prisma/seed.ts)');
    return;
  }

  // جيب المعايير
  const allCriteria = await prisma.evaluationCriteria.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  if (allCriteria.length === 0) {
    console.error('❌ No evaluation criteria found. Run base seed first.');
    return;
  }

  // ===== نموذج فاطمة — مكتمل (COMPLETED) =====
  await prisma.evaluationForm.upsert({
    where: { id: FORM.fatima },
    update: {},
    create: {
      id: FORM.fatima,
      periodId: period.id,
      employeeId: EMP.fatima,
      evaluatorId: EMP.khalid,

      // Self Evaluation — مكتمل
      selfStatus: 'SUBMITTED',
      selfScore: 78.5,
      selfSubmittedAt: new Date('2026-03-10'),
      selfComments: 'أرى أنني أؤدي عملي بكفاءة جيدة وأسعى دائماً للتطور',

      // Manager Evaluation — مكتمل
      managerStatus: 'SUBMITTED',
      managerScore: 82.0,
      managerSubmittedAt: new Date('2026-03-20'),
      managerComments: 'موظفة مجتهدة تُنجز مهامها في الوقت المحدد',
      managerStrengths: 'سرعة التعلم، الالتزام بالمواعيد',
      managerWeaknesses: 'تحتاج إلى تحسين مهارات التواصل مع العملاء',
      managerRecommendations: 'يُنصح بالمشاركة في دورة تدريبية للتواصل الفعّال',

      // HR Review
      hrReviewedBy: EMP.sarah,
      hrReviewedAt: new Date('2026-03-25'),
      hrComments: 'تقييم موضوعي ومتوازن',
      hrRecommendation: 'TRAINING',

      // GM Approval
      gmApprovedBy: EMP.khalid,
      gmApprovedAt: new Date('2026-03-28'),
      gmStatus: 'APPROVED',
      gmComments: 'أوافق على التوصية',

      // Final
      finalScore: 80.25,
      finalRating: 'GOOD',
      status: 'COMPLETED',
    },
  });

  // أقسام نموذج فاطمة
  for (let i = 0; i < allCriteria.length; i++) {
    const c = allCriteria[i];
    await prisma.evaluationSection.upsert({
      where: { formId_criteriaId: { formId: FORM.fatima, criteriaId: c.id } },
      update: {},
      create: {
        formId: FORM.fatima,
        criteriaId: c.id,
        selfScore: 3 + (i % 3),        // 3-5
        managerScore: 3 + ((i + 1) % 3), // 3-5
      },
    });
  }

  console.log('✅ Fatima evaluation form (COMPLETED, score: 80.25)');

  // ===== نموذج عمر — قيد مراجعة HR (PENDING_HR_REVIEW) =====
  await prisma.evaluationForm.upsert({
    where: { id: FORM.omar },
    update: {},
    create: {
      id: FORM.omar,
      periodId: period.id,
      employeeId: EMP.omar,
      evaluatorId: EMP.khalid,

      selfStatus: 'SUBMITTED',
      selfScore: 71.0,
      selfSubmittedAt: new Date('2026-03-12'),
      selfComments: 'أسعى لتحسين أدائي وتطوير مهاراتي التقنية',

      managerStatus: 'SUBMITTED',
      managerScore: 74.5,
      managerSubmittedAt: new Date('2026-03-22'),
      managerComments: 'موظف جيد لكن يحتاج إلى تحسين في إدارة الوقت',
      managerStrengths: 'الإبداع في حل المشاكل التقنية',
      managerWeaknesses: 'إدارة الوقت، التوثيق',

      status: 'PENDING_HR_REVIEW',
    },
  });

  for (let i = 0; i < allCriteria.length; i++) {
    const c = allCriteria[i];
    await prisma.evaluationSection.upsert({
      where: { formId_criteriaId: { formId: FORM.omar, criteriaId: c.id } },
      update: {},
      create: {
        formId: FORM.omar,
        criteriaId: c.id,
        selfScore: 3 + (i % 2),
        managerScore: 3 + (i % 3),
      },
    });
  }

  console.log('✅ Omar evaluation form (PENDING_HR_REVIEW)');

  // ===== نموذج نورة — بانتظار التقييم الذاتي (PENDING_SELF) =====
  await prisma.evaluationForm.upsert({
    where: { id: FORM.nora },
    update: {},
    create: {
      id: FORM.nora,
      periodId: period.id,
      employeeId: EMP.nora,
      evaluatorId: EMP.sarah,

      selfStatus: 'NOT_STARTED',
      managerStatus: 'NOT_STARTED',
      status: 'PENDING_SELF',
    },
  });

  console.log('✅ Nora evaluation form (PENDING_SELF)');
  console.log('🎉 Evaluation demo seed completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
