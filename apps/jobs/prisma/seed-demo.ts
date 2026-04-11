/**
 * seed-demo.ts — بيانات تجريبية للوظائف والمقابلات
 * يفترض إن jobs/seed.ts شغّل قبله (لإنشاء معايير التقييم)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// IDs ثابتة
const POS_ID   = 'pos00001-0000-0000-0000-000000000000';
const POS2_ID  = 'pos00002-0000-0000-0000-000000000000';
const APP1_ID  = 'app00001-0000-0000-0000-000000000000';
const APP2_ID  = 'app00002-0000-0000-0000-000000000000';
const EVAL1_ID = 'evl00001-0000-0000-0000-000000000000';

async function main() {
  console.log('🌱 Seeding demo jobs data...');

  // ===== الشاغر الأول: مطور برمجيات (يحتاج حاسوب) =====
  await (prisma as any).interviewPosition.upsert({
    where: { id: POS_ID },
    update: {},
    create: {
      id: POS_ID,
      jobTitle: 'مطور برمجيات',
      department: 'تقنية المعلومات',
      sectorName: 'قطاع التطوير',
      workType: 'FULL_TIME',
      workMode: 'HYBRID',
      requiresLanguage: true,
      requiresComputer: true,
      committeeMembers: JSON.stringify(['خالد محمد', 'سارة أحمد']),
      interviewDate: new Date('2026-05-15'),
      status: 'OPEN',
    },
  });

  // أسئلة تقنية للشاغر الأول
  const techQuestions1 = [
    { id: 'tq000001-0000-0000-0000-000000000000', question: 'اشرح الفرق بين REST و GraphQL', maxScore: 10, displayOrder: 1 },
    { id: 'tq000002-0000-0000-0000-000000000000', question: 'ما هي مبادئ SOLID؟ واذكر مثالاً عملياً', maxScore: 10, displayOrder: 2 },
    { id: 'tq000003-0000-0000-0000-000000000000', question: 'كيف تتعامل مع مشكلة N+1 في قواعد البيانات؟', maxScore: 10, displayOrder: 3 },
  ];

  for (const q of techQuestions1) {
    await (prisma as any).technicalQuestion.upsert({
      where: { id: q.id },
      update: {},
      create: { ...q, positionId: POS_ID, isActive: true },
    });
  }

  console.log('✅ Position 1: مطور برمجيات (requires computer)');

  // ===== الشاغر الثاني: محاسب (بدون اختبار حاسوب) =====
  await (prisma as any).interviewPosition.upsert({
    where: { id: POS2_ID },
    update: {},
    create: {
      id: POS2_ID,
      jobTitle: 'محاسب',
      department: 'المالية والمحاسبة',
      workType: 'FULL_TIME',
      workMode: 'ON_SITE',
      requiresLanguage: false,
      requiresComputer: false,
      committeeMembers: JSON.stringify(['سارة أحمد']),
      status: 'OPEN',
    },
  });

  // أسئلة تقنية للشاغر الثاني
  const techQuestions2 = [
    { id: 'tq000004-0000-0000-0000-000000000000', question: 'اشرح مبدأ القيد المزدوج في المحاسبة', maxScore: 10, displayOrder: 1 },
    { id: 'tq000005-0000-0000-0000-000000000000', question: 'ما الفرق بين الميزانية العمومية وقائمة الدخل؟', maxScore: 10, displayOrder: 2 },
  ];

  for (const q of techQuestions2) {
    await (prisma as any).technicalQuestion.upsert({
      where: { id: q.id },
      update: {},
      create: { ...q, positionId: POS2_ID, isActive: true },
    });
  }

  console.log('✅ Position 2: محاسب (no computer, no language)');

  // ===== تقييم مقابلة تجريبي =====
  // جيب معايير الصفات الشخصية والحاسوبية
  const personalCriteria = await (prisma as any).personalCriterion.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  const computerCriteria = await (prisma as any).computerCriterion.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  if (personalCriteria.length === 0) {
    console.warn('⚠️  No personal criteria found — run jobs/seed.ts first. Skipping evaluations.');
    console.log('🎉 Jobs demo seed completed (partial — no evaluations)!');
    return;
  }

  // تقييم مقبول
  const existing1 = await (prisma as any).interviewEvaluation.findUnique({ where: { id: EVAL1_ID } });
  if (!existing1) {
    await (prisma as any).interviewEvaluation.create({
      data: {
        id: EVAL1_ID,
        positionId: POS_ID,
        jobApplicationId: APP1_ID,
        candidateName: 'أحمد عبدالله',
        residence: 'الرياض',
        maritalStatus: 'أعزب',
        contactNumber: '+966512345678',
        academicDegree: 'بكالوريوس علوم حاسوب',
        yearsOfExperience: 3,
        expectedSalary: 8000,
        generalNotes: 'مرشح واعد بخلفية تقنية جيدة',
        decision: 'ACCEPTED',
        proposedSalary: 7500,
        evaluatorId: 'e0000002-0000-0000-0000-000000000000',
        evaluatedAt: new Date('2026-04-08'),

        // درجات محسوبة مسبقاً: personal=35, technical=36, computer=16, total=87
        personalScore: 35.0,
        technicalScore: 36.0,
        computerScore: 16.0,
        totalScore: 87.0,
        isTransferred: false,

        personalScores: {
          create: personalCriteria.map((c: any, i: number) => ({
            criterionId: c.id,
            score: i % 2 === 0 ? 5 : 4,
          })),
        },
        technicalScores: {
          create: [
            { questionId: 'tq000001-0000-0000-0000-000000000000', score: 9 },
            { questionId: 'tq000002-0000-0000-0000-000000000000', score: 8 },
            { questionId: 'tq000003-0000-0000-0000-000000000000', score: 7 },
          ],
        },
        computerScores: computerCriteria.length > 0 ? {
          create: computerCriteria.map((c: any) => ({
            criterionId: c.id,
            score: 4,
          })),
        } : undefined,
      },
    });
    console.log('✅ Interview evaluation 1 (ACCEPTED, score: 87)');
  } else {
    console.log('⏭  Interview evaluation 1 already exists');
  }

  // تقييم مرفوض
  const existing2 = await (prisma as any).interviewEvaluation.findUnique({
    where: { jobApplicationId: APP2_ID },
  });
  if (!existing2) {
    await (prisma as any).interviewEvaluation.create({
      data: {
        positionId: POS_ID,
        jobApplicationId: APP2_ID,
        candidateName: 'محمد راشد',
        residence: 'جدة',
        maritalStatus: 'متزوج',
        contactNumber: '+966598765432',
        academicDegree: 'دبلوم',
        yearsOfExperience: 1,
        expectedSalary: 5000,
        generalNotes: 'خبرة محدودة ومعرفة تقنية أساسية',
        decision: 'REJECTED',
        evaluatorId: 'e0000002-0000-0000-0000-000000000000',
        evaluatedAt: new Date('2026-04-09'),

        personalScore: 22.0,
        technicalScore: 18.0,
        computerScore: 10.0,
        totalScore: 50.0,
        isTransferred: false,

        personalScores: {
          create: personalCriteria.map((c: any) => ({
            criterionId: c.id,
            score: 3,
          })),
        },
        technicalScores: {
          create: [
            { questionId: 'tq000001-0000-0000-0000-000000000000', score: 5 },
            { questionId: 'tq000002-0000-0000-0000-000000000000', score: 4 },
            { questionId: 'tq000003-0000-0000-0000-000000000000', score: 4 },
          ],
        },
        computerScores: computerCriteria.length > 0 ? {
          create: computerCriteria.map((c: any) => ({
            criterionId: c.id,
            score: 3,
          })),
        } : undefined,
      },
    });
    console.log('✅ Interview evaluation 2 (REJECTED, score: 50)');
  } else {
    console.log('⏭  Interview evaluation 2 already exists');
  }

  // ===== مرشح تجريبي =====
  const existingCandidate = await (prisma as any).candidates.findFirst({
    where: { phone: '+966511111111' },
  }).catch(() => null);

  if (!existingCandidate) {
    await (prisma as any).candidates.create({
      data: {
        positionId: POS_ID,
        firstNameAr: 'سلمى',
        lastNameAr: 'يوسف',
        firstNameEn: 'Salma',
        lastNameEn: 'Yousef',
        email: 'salma.yousef@example.com',
        phone: '+966511111111',
        currentStage: 'PHONE_INTERVIEW',
        source: 'LINKEDIN',
        expectedSalary: 9000,
        notes: 'خلفية ممتازة في تطوير الويب',
      },
    }).catch(() => {});
  }
  console.log('✅ Sample candidate (Salma Yousef)');

  console.log('🎉 Jobs demo seed completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
