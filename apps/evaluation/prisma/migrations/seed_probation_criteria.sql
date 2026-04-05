-- Seed 18 Probation Criteria (idempotent - skip if exists)
INSERT INTO "evaluation"."ProbationCriteria" ("id", "nameAr", "nameEn", "isCore", "isActive", "displayOrder", "updatedAt") VALUES
  ('prob-c-01', 'الالتزام بمواعيد العمل', 'Attendance & Punctuality', true, true, 1, CURRENT_TIMESTAMP),
  ('prob-c-02', 'الانضباط والسلوك المهني', 'Discipline & Professional Conduct', true, true, 2, CURRENT_TIMESTAMP),
  ('prob-c-03', 'الالتزام بالأنظمة واللوائح', 'Compliance with Regulations', true, true, 3, CURRENT_TIMESTAMP),
  ('prob-c-04', 'جودة العمل والدقة', 'Work Quality & Accuracy', true, true, 4, CURRENT_TIMESTAMP),
  ('prob-c-05', 'الإنتاجية وإنجاز المهام', 'Productivity & Task Completion', true, true, 5, CURRENT_TIMESTAMP),
  ('prob-c-06', 'القدرة على التعلم والتطور', 'Learning & Development Ability', true, true, 6, CURRENT_TIMESTAMP),
  ('prob-c-07', 'التعاون وروح الفريق', 'Teamwork & Cooperation', true, true, 7, CURRENT_TIMESTAMP),
  ('prob-c-08', 'التواصل وأسلوب التعامل', 'Communication Skills', true, true, 8, CURRENT_TIMESTAMP),
  ('prob-c-09', 'المبادرة والاستباقية', 'Initiative & Proactiveness', false, true, 9, CURRENT_TIMESTAMP),
  ('prob-c-10', 'القدرة على اتخاذ القرار', 'Decision Making Ability', false, true, 10, CURRENT_TIMESTAMP),
  ('prob-c-11', 'إدارة الوقت والأولويات', 'Time Management & Prioritization', false, true, 11, CURRENT_TIMESTAMP),
  ('prob-c-12', 'الكفاءة التقنية والمهارات الوظيفية', 'Technical Competency & Job Skills', false, true, 12, CURRENT_TIMESTAMP),
  ('prob-c-13', 'خدمة العملاء والتعامل مع المراجعين', 'Customer Service & Public Relations', false, true, 13, CURRENT_TIMESTAMP),
  ('prob-c-14', 'الحفاظ على سرية المعلومات', 'Confidentiality & Information Security', false, true, 14, CURRENT_TIMESTAMP),
  ('prob-c-15', 'الالتزام بالسلامة المهنية', 'Occupational Safety Compliance', false, true, 15, CURRENT_TIMESTAMP),
  ('prob-c-16', 'المظهر اللائق والهيئة العامة', 'Appearance & General Demeanor', false, true, 16, CURRENT_TIMESTAMP),
  ('prob-c-17', 'قبول التغذية الراجعة والتطوير الذاتي', 'Feedback Acceptance & Self-Improvement', false, true, 17, CURRENT_TIMESTAMP),
  ('prob-c-18', 'الولاء والانتماء المؤسسي', 'Organizational Loyalty & Belonging', false, true, 18, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
