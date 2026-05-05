import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding evaluation...');

  // ProbationCriteria
  await prisma.$executeRawUnsafe(`
INSERT INTO evaluation."ProbationCriteria" (id, "nameAr", "nameEn", "isCore", "isActive", "displayOrder", "createdAt", "updatedAt")
VALUES
  ('4075be64-45d4-48ef-9eda-b31eaf739816', 'الالتزام بساعات عمل الدوام الرسمي', NULL, TRUE, TRUE, 1, '2026-04-11 12:12:22.7', '2026-04-11 12:12:22.7'),
  ('c06f1b2e-7e91-4d9a-bcc1-cdb07f222dfc', 'الموظف كان يتسم بالسلوك المناسب أثناء فترة التجربة', NULL, TRUE, TRUE, 2, '2026-04-11 12:12:22.702', '2026-04-11 12:12:22.702'),
  ('7efef845-35fd-4254-96a8-f5e292d8aaaf', 'تنفيذ التعليمات بدقة', NULL, TRUE, TRUE, 3, '2026-04-11 12:12:22.703', '2026-04-11 12:12:22.703'),
  ('94574c6f-2ac5-474e-9b5f-d043c0cb9642', 'اهتمام الموظف وجديته في فهم مهامه', NULL, TRUE, TRUE, 4, '2026-04-11 12:12:22.705', '2026-04-11 12:12:22.705'),
  ('9da124cb-c862-456c-8f60-a63f1cdeebbe', 'التواصل الفعال مع فريق عمله واحترام التسلسل الوظيفي', NULL, TRUE, TRUE, 5, '2026-04-11 12:12:22.706', '2026-04-11 12:12:22.706'),
  ('b27fff5e-6bb1-42ee-889d-1f2d7bfdf35a', 'التعبير الكتابي والصياغة السليمة', NULL, TRUE, TRUE, 6, '2026-04-11 12:12:22.708', '2026-04-11 12:12:22.708'),
  ('42338bf6-ffc4-463a-9bcc-43842167e7f1', 'التعبير الشفهي المنطوق', NULL, TRUE, TRUE, 7, '2026-04-11 12:12:22.71', '2026-04-11 12:12:22.71'),
  ('15f8b708-a834-46f1-ac71-99fd63db94c2', 'إعداد التقارير والمتابعة', NULL, TRUE, TRUE, 8, '2026-04-11 12:12:22.711', '2026-04-11 12:12:22.711'),
  ('c5856864-6abf-4025-8543-c1ac4a5d3f5f', 'القدرة على اتخاذ القرارات وحل المسائل المعقدة', NULL, TRUE, TRUE, 9, '2026-04-11 12:12:22.713', '2026-04-11 12:12:22.713'),
  ('192c281c-afd6-4339-a737-f252584f5e41', 'القدرة على الإضافة للوظيفة', NULL, TRUE, TRUE, 10, '2026-04-11 12:12:22.714', '2026-04-11 12:12:22.714'),
  ('5d8450b2-dfd2-4d65-9cb8-24b434ead05e', 'القدرة على العمل ضمن فريق', NULL, TRUE, TRUE, 11, '2026-04-11 12:12:22.716', '2026-04-11 12:12:22.716'),
  ('b209a47b-2920-4704-93b6-faa23d4a20b8', 'الرغبة في التعلم وطرح التساؤلات العملية', NULL, TRUE, TRUE, 12, '2026-04-11 12:12:22.717', '2026-04-11 12:12:22.717'),
  ('306333ac-f874-44c2-8259-5bbdcd2375a8', 'القدرة على تنفيذ مهام متعددة في وقت واحد', NULL, TRUE, TRUE, 13, '2026-04-11 12:12:22.718', '2026-04-11 12:12:22.718'),
  ('8f02a934-3cbe-4849-b10c-75f582551279', 'القدرة على تسليم المهام في الوقت المحدد', NULL, TRUE, TRUE, 14, '2026-04-11 12:12:22.72', '2026-04-11 12:12:22.72'),
  ('79ce49b1-576d-4fb0-935f-9191641442f6', 'حضور الاجتماعات والالتزام بقواعدها', NULL, TRUE, TRUE, 15, '2026-04-11 12:12:22.722', '2026-04-11 12:12:22.722'),
  ('72348f63-225d-40af-8bcc-810796f05be0', 'جودة الأعمال التي يقوم بها', NULL, TRUE, TRUE, 16, '2026-04-11 12:12:22.723', '2026-04-11 12:12:22.723'),
  ('7771717c-d8cd-45fb-9c1c-aad292645ca2', 'القدرة على إدارة الوقت وتحديد الأولويات', NULL, TRUE, TRUE, 17, '2026-04-11 12:12:22.725', '2026-04-11 12:12:22.725'),
  ('970d1f6b-4545-478e-aeb9-8cd488f355d4', 'احترام خصوصيات وأسرار العمل والالتزام بقوانين الشركة', NULL, TRUE, TRUE, 18, '2026-04-11 12:12:22.726', '2026-04-11 12:12:22.726')
ON CONFLICT DO NOTHING;
  `);

  // EvaluationCriteria
  await prisma.$executeRawUnsafe(`
INSERT INTO evaluation."EvaluationCriteria" (id, code, "nameAr", "nameEn", "descriptionAr", "descriptionEn", weight, "maxScore", category, "isActive", "displayOrder", "createdAt", "updatedAt")
VALUES
  ('6aa07c01-beb5-4ead-8c43-361310c0f8ff', 'PERF_001', 'جودة العمل', 'Quality of Work', 'مستوى الدقة والإتقان في إنجاز المهام', 'Level of accuracy and excellence in completing tasks', 1.5, 5, 'PERFORMANCE', TRUE, 1, '2026-04-11 12:12:22.596', '2026-04-11 12:12:22.596'),
  ('8e3be3fd-0464-4513-b460-08b22f5dd75c', 'PERF_002', 'الإنتاجية', 'Productivity', 'كمية العمل المنجز خلال الفترة الزمنية المحددة', 'Amount of work completed within the specified time period', 1.5, 5, 'PERFORMANCE', TRUE, 2, '2026-04-11 12:12:22.679', '2026-04-11 12:12:22.679'),
  ('984cb089-6480-419b-860b-e4dd82fdcc4b', 'PERF_003', 'الالتزام بالمواعيد', 'Timeliness', 'القدرة على إنجاز المهام في الوقت المحدد', 'Ability to complete tasks on time', 1, 5, 'PERFORMANCE', TRUE, 3, '2026-04-11 12:12:22.681', '2026-04-11 12:12:22.681'),
  ('b2ee5f2b-7b40-4af0-a802-f73db57f63c4', 'BEH_001', 'الانضباط الوظيفي', 'Work Discipline', 'الالتزام بمواعيد العمل والسياسات المؤسسية', 'Adherence to work schedules and organizational policies', 1, 5, 'BEHAVIOR', TRUE, 4, '2026-04-11 12:12:22.683', '2026-04-11 12:12:22.683'),
  ('333fc70f-de50-4a2a-9407-1800e1b8320b', 'BEH_002', 'التعاون مع الفريق', 'Teamwork', 'القدرة على العمل ضمن فريق والتفاعل مع الزملاء', 'Ability to work within a team and interact with colleagues', 1.2, 5, 'BEHAVIOR', TRUE, 5, '2026-04-11 12:12:22.684', '2026-04-11 12:12:22.684'),
  ('175b74c6-9177-4431-91ef-a7441cbf7d27', 'BEH_003', 'الاحترافية', 'Professionalism', 'السلوك المهني والأخلاقيات في العمل', 'Professional conduct and work ethics', 1, 5, 'BEHAVIOR', TRUE, 6, '2026-04-11 12:12:22.686', '2026-04-11 12:12:22.686'),
  ('65dafdc9-028b-48c8-bce3-4a2fb3c3a2c9', 'SKILL_001', 'المهارات الفنية', 'Technical Skills', 'الكفاءة في استخدام الأدوات والتقنيات المطلوبة للوظيفة', 'Proficiency in using tools and technologies required for the job', 1.3, 5, 'SKILLS', TRUE, 7, '2026-04-11 12:12:22.688', '2026-04-11 12:12:22.688'),
  ('334cddb1-2593-441f-9beb-191f8008b22e', 'SKILL_002', 'مهارات التواصل', 'Communication Skills', 'القدرة على التواصل الفعال شفهياً وكتابياً', 'Ability to communicate effectively verbally and in writing', 1, 5, 'SKILLS', TRUE, 8, '2026-04-11 12:12:22.689', '2026-04-11 12:12:22.689'),
  ('38ab971d-36b3-4e9a-824a-608cb9439da7', 'ACH_001', 'تحقيق الأهداف', 'Goal Achievement', 'نسبة تحقيق الأهداف المحددة خلال الفترة', 'Percentage of goals achieved during the period', 2, 5, 'ACHIEVEMENT', TRUE, 9, '2026-04-11 12:12:22.69', '2026-04-11 12:12:22.69'),
  ('6178a2c9-7a03-4e5f-8c4e-40d15ef1b7e5', 'ACH_002', 'المبادرة والابتكار', 'Initiative and Innovation', 'القدرة على اقتراح أفكار جديدة وتحسينات', 'Ability to propose new ideas and improvements', 1.2, 5, 'ACHIEVEMENT', TRUE, 10, '2026-04-11 12:12:22.692', '2026-04-11 12:12:22.692'),
  ('9b6ace69-4a64-49af-9bc8-109e538c33e0', 'DEV_001', 'التعلم والتطوير', 'Learning and Development', 'الاهتمام بالتطوير الذاتي وتعلم مهارات جديدة', 'Interest in self-development and learning new skills', 1, 5, 'DEVELOPMENT', TRUE, 11, '2026-04-11 12:12:22.693', '2026-04-11 12:12:22.693'),
  ('bd8712a3-3978-4e08-bc3b-cf8860c983f3', 'DEV_002', 'القيادة والإشراف', 'Leadership and Supervision', 'القدرة على قيادة الآخرين وتوجيههم (إن وجد)', 'Ability to lead and guide others (if applicable)', 1.5, 5, 'DEVELOPMENT', TRUE, 12, '2026-04-11 12:12:22.695', '2026-04-11 12:12:22.695')
ON CONFLICT DO NOTHING;
  `);

  // EvaluationPeriod
  await prisma.$executeRawUnsafe(`
INSERT INTO evaluation."EvaluationPeriod" (id, code, "nameAr", "nameEn", "startDate", "endDate", status, "isActive", "createdAt", "updatedAt")
VALUES
  ('93d66e78-b0db-4798-993c-60a137902ce3', 'EVAL_2026', 'دورة التقييم السنوية 2026', 'Annual Evaluation Period 2026', '2026-01-01', '2026-12-31', 'DRAFT', TRUE, '2026-04-11 12:12:22.697', '2026-04-11 12:12:22.697')
ON CONFLICT DO NOTHING;
  `);

  console.log('evaluation seeding done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
