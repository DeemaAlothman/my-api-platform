-- استيراد تمارين العمود القطني (24 تمرين) — آمن للتكرار: ما بيضيف تمرين موجود بنفس الاسم
BEGIN;
-- 1. إمالة الحوض
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'إمالة الحوض', 'Pelvic Tilt', 'وضعية البداية: الاستلقاء على الظهر مع ثني الركبتين والقدمين على الأرض.', 'Starting position: Lie on your back with knees bent and feet flat on the floor.',
  'seed-body-region-lumbar-spine', '674f4887-72f8-4422-b676-ab6e746a1987', 'VIDEO',
  'حرّك الحوض ببطء لإزالة الفراغ بين أسفل الظهر والأرض، ثم عد إلى الوضع الطبيعي. التكرارات: 10–15 تكرار.', 'Slowly tilt the pelvis to close the gap between the lower back and the floor, then return to the neutral position. Reps: 10–15 reps.', 'نفّذ الحركة ببطء وضمن مدى مريح.', 'Perform the movement slowly and within a comfortable range.',
  NULL, NULL,
  NULL, 3, 10, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'إمالة الحوض' AND "deletedAt" IS NULL
);
-- 2. سحب الركبة نحو الصدر
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'سحب الركبة نحو الصدر', 'Knee to Chest', 'وضعية البداية: الاستلقاء على الظهر مع مدّ الساقين.', 'Starting position: Lie on your back with legs extended.',
  'seed-body-region-lumbar-spine', '674f4887-72f8-4422-b676-ab6e746a1987', 'VIDEO',
  'اسحب ركبة واحدة ببطء باتجاه الصدر، ثم أعدها إلى وضع البداية وكرر بالساق الأخرى. التكرارات: 10–15 تكرار لكل ساق.', 'Slowly draw one knee toward the chest, return it to the starting position, then repeat with the other leg. Reps: 10–15 reps per leg.', 'حافظ على الحركة مريحة وتجنب الشد القوي في أسفل الظهر.', 'Keep the movement comfortable and avoid a strong pull in the lower back.',
  NULL, NULL,
  NULL, 3, 10, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'سحب الركبة نحو الصدر' AND "deletedAt" IS NULL
);
-- 3. دوران الجذع أثناء الاستلقاء
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'دوران الجذع أثناء الاستلقاء', 'Supine Trunk Rotation', 'وضعية البداية: الاستلقاء على الظهر مع ثني الركبتين والقدمين على الأرض.', 'Starting position: Lie on your back with knees bent and feet flat on the floor.',
  'seed-body-region-lumbar-spine', '674f4887-72f8-4422-b676-ab6e746a1987', 'VIDEO',
  'حرّك الركبتين ببطء إلى أحد الجانبين ضمن مدى مريح، ثم أعدهما إلى المنتصف وكرر للجانب الآخر. التكرارات: 10–15 تكرار لكل جهة.', 'Slowly lower both knees to one side within a comfortable range, bring them back to the middle, then repeat to the other side. Reps: 10–15 reps per side.', 'حافظ على الكتفين ملامسين للأرض قدر الإمكان.', 'Keep the shoulders in contact with the floor as much as possible.',
  NULL, NULL,
  NULL, 3, 10, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'دوران الجذع أثناء الاستلقاء' AND "deletedAt" IS NULL
);
-- 4. حركة القطة والجمل
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'حركة القطة والجمل', 'Cat-Camel', 'وضعية البداية: الارتكاز على اليدين والركبتين مع وضع اليدين تحت الكتفين والركبتين تحت الحوض.', 'Starting position: Start on hands and knees, hands under the shoulders and knees under the hips.',
  'seed-body-region-lumbar-spine', '674f4887-72f8-4422-b676-ab6e746a1987', 'VIDEO',
  'قرّب البطن للداخل وارفع الظهر للأعلى تدريجيًا، ثم اخفض الظهر وارفع الصدر بلطف للعودة إلى الاتجاه المعاكس. التكرارات: 10–15 تكرار.', 'Draw the abdomen in and gradually round the back upward, then lower the back and gently lift the chest to move in the opposite direction. Reps: 10–15 reps.', 'نفّذ الحركة بسلاسة ودون الوصول إلى مدى يسبب الألم.', 'Move smoothly and do not go into a range that causes pain.',
  NULL, NULL,
  NULL, 3, 10, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'حركة القطة والجمل' AND "deletedAt" IS NULL
);
-- 5. إطالة أسفل الظهر مع سحب الركبة للصدر
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'إطالة أسفل الظهر مع سحب الركبة للصدر', 'Lower Back Stretch with Single Knee to Chest', 'وضعية البداية: الاستلقاء على الظهر مع مدّ الساقين.', 'Starting position: Lie on your back with legs extended.',
  'seed-body-region-lumbar-spine', 'a9394b75-ffb7-4bf2-a2dc-cbb9b4beaa7f', 'VIDEO',
  'اسحب ركبة واحدة باتجاه الصدر باستخدام اليدين حتى تشعر بتمدد مريح في أسفل الظهر، ثم بدّل الجهة. مدة التثبيت: 20–30 ثانية لكل ساق.', 'Pull one knee toward the chest with both hands until you feel a comfortable stretch in the lower back, then switch sides. Hold: 20–30 seconds per leg.', 'لا تسحب الركبة بقوة.', 'Do not pull the knee forcefully.',
  NULL, NULL,
  NULL, 3, NULL, 20, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'إطالة أسفل الظهر مع سحب الركبة للصدر' AND "deletedAt" IS NULL
);
-- 6. إطالة الركبتين نحو الصدر
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'إطالة الركبتين نحو الصدر', 'Double Knee to Chest Stretch', 'وضعية البداية: الاستلقاء على الظهر مع ثني الركبتين.', 'Starting position: Lie on your back with knees bent.',
  'seed-body-region-lumbar-spine', 'a9394b75-ffb7-4bf2-a2dc-cbb9b4beaa7f', 'VIDEO',
  'اسحب الركبتين معًا باتجاه الصدر وحافظ على الوضعية مع تنفس طبيعي. مدة التثبيت: 20–30 ثانية.', 'Pull both knees together toward the chest and hold the position while breathing normally. Hold: 20–30 seconds.', 'نفّذ التمرين ضمن مدى مريح.', 'Perform the exercise within a comfortable range.',
  NULL, NULL,
  NULL, 3, NULL, 20, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'إطالة الركبتين نحو الصدر' AND "deletedAt" IS NULL
);
-- 7. إطالة وضعية الطفل
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'إطالة وضعية الطفل', 'Child''s Pose Stretch', 'وضعية البداية: الارتكاز على اليدين والركبتين.', 'Starting position: Start on hands and knees.',
  'seed-body-region-lumbar-spine', 'a9394b75-ffb7-4bf2-a2dc-cbb9b4beaa7f', 'VIDEO',
  'ادفع الحوض ببطء باتجاه الكعبين ومدّ الذراعين للأمام حتى تشعر بتمدد مريح في أسفل الظهر. مدة التثبيت: 20–30 ثانية.', 'Slowly push the hips back toward the heels and reach the arms forward until you feel a comfortable stretch in the lower back. Hold: 20–30 seconds.', 'يمكن تقليل مدى الحركة إذا كان هناك ألم أو عدم راحة.', 'Reduce the range of motion if there is pain or discomfort.',
  NULL, NULL,
  NULL, 3, NULL, 20, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'إطالة وضعية الطفل' AND "deletedAt" IS NULL
);
-- 8. إطالة عضلات خلف الفخذ
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'إطالة عضلات خلف الفخذ', 'Hamstring Stretch', 'وضعية البداية: الاستلقاء على الظهر مع مدّ إحدى الساقين ورفع الأخرى.', 'Starting position: Lie on your back with one leg extended and the other raised.',
  'seed-body-region-lumbar-spine', 'a9394b75-ffb7-4bf2-a2dc-cbb9b4beaa7f', 'VIDEO',
  'ارفع الساق تدريجيًا مع الحفاظ على الركبة ممدودة حتى تشعر بتمدد خلف الفخذ. مدة التثبيت: 20–30 ثانية لكل ساق.', 'Gradually raise the leg while keeping the knee straight until you feel a stretch at the back of the thigh. Hold: 20–30 seconds per leg.', 'تجنب تقريب الساق إلى مدى يسبب ألمًا في أسفل الظهر.', 'Avoid bringing the leg into a range that causes lower back pain.',
  NULL, NULL,
  NULL, 3, NULL, 20, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'إطالة عضلات خلف الفخذ' AND "deletedAt" IS NULL
);
-- 9. شد عضلات البطن
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'شد عضلات البطن', 'Abdominal Bracing', 'وضعية البداية: الاستلقاء على الظهر مع ثني الركبتين والقدمين على الأرض.', 'Starting position: Lie on your back with knees bent and feet flat on the floor.',
  'seed-body-region-lumbar-spine', 'd380ba68-e440-4d89-a683-6f9031ac2460', 'VIDEO',
  'شد عضلات البطن بلطف كما لو أنك تحاول تقريب البطن نحو العمود الفقري، مع الحفاظ على التنفس الطبيعي. مدة التثبيت: 5–10 ثوانٍ. التكرارات: 8–10 تكرارات.', 'Gently tighten the abdominal muscles as if drawing the abdomen toward the spine, while breathing normally. Hold: 5–10 seconds. Reps: 8–10 reps.', 'لا تحبس النفس ولا تضغط بقوة.', 'Do not hold your breath or brace forcefully.',
  NULL, NULL,
  NULL, 3, 8, 5, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'شد عضلات البطن' AND "deletedAt" IS NULL
);
-- 10. الضغط بالكعبين على الأرض
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'الضغط بالكعبين على الأرض', 'Heel Press into the Floor', 'وضعية البداية: الاستلقاء على الظهر مع ثني الركبتين والقدمين على الأرض.', 'Starting position: Lie on your back with knees bent and feet flat on the floor.',
  'seed-body-region-lumbar-spine', 'd380ba68-e440-4d89-a683-6f9031ac2460', 'VIDEO',
  'اضغط بالكعبين باتجاه الأرض مع شد عضلات البطن دون تحريك الحوض. مدة التثبيت: 5–10 ثوانٍ. التكرارات: 8–10 تكرارات.', 'Press the heels into the floor while tightening the abdominal muscles, without moving the pelvis. Hold: 5–10 seconds. Reps: 8–10 reps.', 'حافظ على ثبات أسفل الظهر والحوض.', 'Keep the lower back and pelvis still.',
  NULL, NULL,
  NULL, 3, 8, 5, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'الضغط بالكعبين على الأرض' AND "deletedAt" IS NULL
);
-- 11. شد عضلات البطن مع رفع الذراع
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'شد عضلات البطن مع رفع الذراع', 'Abdominal Bracing with Arm Raise', 'وضعية البداية: الاستلقاء على الظهر مع ثني الركبتين ورفع الذراعين باتجاه السقف.', 'Starting position: Lie on your back with knees bent and arms raised toward the ceiling.',
  'seed-body-region-lumbar-spine', 'd380ba68-e440-4d89-a683-6f9031ac2460', 'VIDEO',
  'شد عضلات البطن وحافظ على ثبات الحوض أثناء رفع أحد الذراعين أو تحريكه للخلف بشكل بسيط. مدة التثبيت: 5–10 ثوانٍ. التكرارات: 8–10 تكرارات لكل جهة.', 'Tighten the abdominal muscles and keep the pelvis still while raising one arm or moving it slightly backward. Hold: 5–10 seconds. Reps: 8–10 reps per side.', 'يجب ألا يتغير وضع أسفل الظهر أثناء الحركة.', 'The position of the lower back must not change during the movement.',
  NULL, NULL,
  NULL, 3, 8, 5, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'شد عضلات البطن مع رفع الذراع' AND "deletedAt" IS NULL
);
-- 12. الثبات على وضعية الجسر
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'الثبات على وضعية الجسر', 'Bridge Hold', 'وضعية البداية: الاستلقاء على الظهر مع ثني الركبتين والقدمين على الأرض.', 'Starting position: Lie on your back with knees bent and feet flat on the floor.',
  'seed-body-region-lumbar-spine', 'd380ba68-e440-4d89-a683-6f9031ac2460', 'VIDEO',
  'ارفع الحوض إلى وضعية الجسر وحافظ على الوضعية مع شد عضلات البطن والأرداف. مدة التثبيت: 10–20 ثانية. التكرارات: 5–8 تكرارات.', 'Lift the pelvis into the bridge position and hold it while tightening the abdominal and gluteal muscles. Hold: 10–20 seconds. Reps: 5–8 reps.', 'حافظ على الحوض بمستوى واحد وتجنب زيادة تقوس أسفل الظهر.', 'Keep the pelvis level and avoid increasing the arch of the lower back.',
  NULL, NULL,
  NULL, 3, 5, 10, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'الثبات على وضعية الجسر' AND "deletedAt" IS NULL
);
-- 13. الجسر
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'الجسر', 'Bridge', 'وضعية البداية: الاستلقاء على الظهر مع ثني الركبتين والقدمين على الأرض.', 'Starting position: Lie on your back with knees bent and feet flat on the floor.',
  'seed-body-region-lumbar-spine', 'd09caf40-3457-4e55-8924-9c922def2045', 'VIDEO',
  'ارفع الحوض ببطء حتى يصبح الجسم بخط مستقيم تقريبًا من الكتفين إلى الركبتين، ثم اخفضه ببطء. التكرارات: 10–15 تكرار.', 'Slowly lift the pelvis until the body forms a nearly straight line from shoulders to knees, then lower it slowly. Reps: 10–15 reps.', 'حافظ على التحكم بالحركة وتجنب فرط تقوس أسفل الظهر.', 'Keep the movement controlled and avoid over-arching the lower back.',
  NULL, NULL,
  NULL, 3, 10, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'الجسر' AND "deletedAt" IS NULL
);
-- 14. الجسر مع مدّ ساق واحدة
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'الجسر مع مدّ ساق واحدة', 'Bridge with Single Leg Extension', 'وضعية البداية: الاستلقاء على الظهر مع ثني الركبتين ورفع الحوض إلى وضعية الجسر.', 'Starting position: Lie on your back with knees bent and the pelvis lifted into the bridge position.',
  'seed-body-region-lumbar-spine', 'd09caf40-3457-4e55-8924-9c922def2045', 'VIDEO',
  'حافظ على الحوض ثابتًا ومدّ إحدى الساقين للأمام، ثم أعدها وكرر بالساق الأخرى. التكرارات: 8–10 تكرارات لكل ساق.', 'Keep the pelvis steady and extend one leg forward, return it, then repeat with the other leg. Reps: 8–10 reps per leg.', 'لا تسمح للحوض بالهبوط أو الدوران أثناء مد الساق.', 'Do not let the pelvis drop or rotate while extending the leg.',
  NULL, NULL,
  NULL, 3, 8, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'الجسر مع مدّ ساق واحدة' AND "deletedAt" IS NULL
);
-- 15. تمرين البيرد دوغ
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'تمرين البيرد دوغ', 'Bird Dog Exercise', 'وضعية البداية: الارتكاز على اليدين والركبتين مع وضع اليدين تحت الكتفين والركبتين تحت الحوض.', 'Starting position: Start on hands and knees, hands under the shoulders and knees under the hips.',
  'seed-body-region-lumbar-spine', 'd09caf40-3457-4e55-8924-9c922def2045', 'VIDEO',
  'مدّ الذراع المقابلة والساق المقابلة ببطء، ثم أعدهما إلى وضع البداية وبدّل الجهة. التكرارات: 8–12 تكرار لكل جهة.', 'Slowly extend the opposite arm and leg, return them to the starting position, then switch sides. Reps: 8–12 reps per side.', 'حافظ على العمود الفقري ثابتًا وتجنب دوران الحوض.', 'Keep the spine stable and avoid rotating the pelvis.',
  NULL, NULL,
  NULL, 3, 8, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'تمرين البيرد دوغ' AND "deletedAt" IS NULL
);
-- 16. تمرين البِلَانك
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'تمرين البِلَانك', 'Plank', 'وضعية البداية: الارتكاز على الساعدين وأصابع القدمين مع الحفاظ على الجسم بخط مستقيم.', 'Starting position: Support yourself on the forearms and toes, keeping the body in a straight line.',
  'seed-body-region-lumbar-spine', 'd09caf40-3457-4e55-8924-9c922def2045', 'VIDEO',
  'شد عضلات البطن وحافظ على ثبات الجسم دون رفع أو خفض الحوض. مدة التثبيت: 15–30 ثانية.', 'Tighten the abdominal muscles and hold the body steady without raising or lowering the pelvis. Hold: 15–30 seconds.', 'يمكن البدء بالارتكاز على الركبتين لتقليل شدة التمرين.', 'You can start on the knees to reduce the intensity.',
  NULL, NULL,
  NULL, 3, NULL, 15, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'تمرين البِلَانك' AND "deletedAt" IS NULL
);
-- 17. ديد بغ (Dead Bug)
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'ديد بغ (Dead Bug)', 'Dead Bug', 'وضعية البداية: الاستلقاء على الظهر مع ثني الوركين والركبتين ورفع الذراعين للأعلى.', 'Starting position: Lie on your back with hips and knees bent and arms raised upward.',
  'seed-body-region-lumbar-spine', 'd09caf40-3457-4e55-8924-9c922def2045', 'VIDEO',
  'مدّ ذراع وساق متعاكستين ببطء، ثم أعدهما إلى وضع البداية وبدّل الجهة. التكرارات: 8–12 تكرار لكل جهة.', 'Slowly extend the opposite arm and leg, return them to the starting position, then switch sides. Reps: 8–12 reps per side.', 'حافظ على ثبات الحوض وأسفل الظهر أثناء الحركة.', 'Keep the pelvis and lower back stable during the movement.',
  NULL, NULL,
  NULL, 3, 8, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'ديد بغ (Dead Bug)' AND "deletedAt" IS NULL
);
-- 18. بيرد دوغ
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'بيرد دوغ', 'Bird Dog', 'وضعية البداية: الارتكاز على اليدين والركبتين.', 'Starting position: Start on hands and knees.',
  'seed-body-region-lumbar-spine', 'd09caf40-3457-4e55-8924-9c922def2045', 'VIDEO',
  'مدّ الذراع والساق المتعاكسين ببطء، حافظ على الوضعية للحظة، ثم عد إلى البداية. التكرارات: 8–12 تكرار لكل جهة.', 'Slowly extend the opposite arm and leg, hold the position for a moment, then return to the start. Reps: 8–12 reps per side.', 'تجنب رفع الساق أو الذراع أعلى من مستوى الجسم.', 'Avoid lifting the leg or arm higher than body level.',
  NULL, NULL,
  NULL, 3, 8, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'بيرد دوغ' AND "deletedAt" IS NULL
);
-- 19. البلانك الجانبي
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'البلانك الجانبي', 'Side Plank', 'وضعية البداية: الاستلقاء على أحد الجانبين مع الارتكاز على الساعد والركبتين أو القدمين.', 'Starting position: Lie on one side, supported on the forearm and the knees or feet.',
  'seed-body-region-lumbar-spine', 'd09caf40-3457-4e55-8924-9c922def2045', 'VIDEO',
  'ارفع الحوض عن الأرض وحافظ على الجسم بوضع مستقيم. مدة التثبيت: 15–30 ثانية لكل جهة.', 'Lift the pelvis off the floor and keep the body in a straight line. Hold: 15–30 seconds per side.', 'يمكن البدء بالارتكاز على الركبتين ثم زيادة الصعوبة تدريجيًا.', 'You can start on the knees and increase the difficulty gradually.',
  NULL, NULL,
  NULL, 3, NULL, 15, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'البلانك الجانبي' AND "deletedAt" IS NULL
);
-- 20. نصف القرفصاء مع الحفاظ على الجذع
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'نصف القرفصاء مع الحفاظ على الجذع', 'Half Squat with Trunk Control', 'وضعية البداية: الوقوف والقدمان بعرض الحوض.', 'Starting position: Stand with feet hip-width apart.',
  'seed-body-region-lumbar-spine', 'c72134d1-8a74-4ee8-927a-75c552ad240e', 'VIDEO',
  'اثنِ الركبتين والوركين تدريجيًا للنزول إلى نصف قرفصاء، ثم عد إلى الوقوف مع الحفاظ على الجذع ثابتًا. التكرارات: 10–15 تكرار.', 'Gradually bend the knees and hips to lower into a half squat, then return to standing while keeping the trunk steady. Reps: 10–15 reps.', 'حافظ على الركبتين بمحاذاة القدمين وتجنب الانحناء الزائد للأمام.', 'Keep the knees aligned with the feet and avoid leaning too far forward.',
  NULL, NULL,
  NULL, 3, 10, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'نصف القرفصاء مع الحفاظ على الجذع' AND "deletedAt" IS NULL
);
-- 21. الوقوف على ساق واحدة
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'الوقوف على ساق واحدة', 'Single Leg Stance', 'وضعية البداية: الوقوف بالقرب من حائط أو سطح ثابت.', 'Starting position: Stand near a wall or a stable surface.',
  'seed-body-region-lumbar-spine', '7c69e365-2b61-4be2-998f-663d5ee62f53', 'VIDEO',
  'ارفع إحدى القدمين عن الأرض وحافظ على التوازن على الساق الأخرى مع إبقاء الجذع والحوض ثابتين. مدة التثبيت: 20–30 ثانية لكل ساق.', 'Lift one foot off the floor and balance on the other leg while keeping the trunk and pelvis steady. Hold: 20–30 seconds per leg.', 'استخدم الدعم عند الحاجة.', 'Use support when needed.',
  NULL, NULL,
  NULL, 3, NULL, 20, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'الوقوف على ساق واحدة' AND "deletedAt" IS NULL
);
-- 22. الوقوف على ساق واحدة مع حركة الذراعين
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'الوقوف على ساق واحدة مع حركة الذراعين', 'Single Leg Stance with Arm Movement', 'وضعية البداية: الوقوف على ساق واحدة بالقرب من سطح ثابت.', 'Starting position: Stand on one leg near a stable surface.',
  'seed-body-region-lumbar-spine', '7c69e365-2b61-4be2-998f-663d5ee62f53', 'VIDEO',
  'حافظ على التوازن أثناء تحريك الذراعين ببطء في اتجاهات مختلفة. مدة التثبيت: 20–30 ثانية لكل ساق.', 'Maintain balance while slowly moving the arms in different directions. Hold: 20–30 seconds per leg.', 'حافظ على ثبات الجذع والحوض قدر الإمكان.', 'Keep the trunk and pelvis as steady as possible.',
  NULL, NULL,
  NULL, 3, NULL, 20, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'الوقوف على ساق واحدة مع حركة الذراعين' AND "deletedAt" IS NULL
);
-- 23. المشي من الكعب إلى أصابع القدم
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'المشي من الكعب إلى أصابع القدم', 'Heel-to-Toe Walk', 'وضعية البداية: الوقوف في بداية مسار مستقيم وآمن.', 'Starting position: Stand at the start of a straight, safe path.',
  'seed-body-region-lumbar-spine', '7c69e365-2b61-4be2-998f-663d5ee62f53', 'VIDEO',
  'امشِ ببطء بوضع كعب القدم أمام أصابع القدم الأخرى مع الحفاظ على استقامة الجذع والتوازن. التكرارات: 10–15 خطوة.', 'Walk slowly, placing the heel of one foot in front of the toes of the other, keeping the trunk upright and balanced. Reps: 10–15 steps.', 'نفّذ التمرين بالقرب من سطح ثابت عند الحاجة.', 'Perform the exercise near a stable surface when needed.',
  NULL, NULL,
  NULL, 3, 10, NULL, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'المشي من الكعب إلى أصابع القدم' AND "deletedAt" IS NULL
);
-- 24. الوقوف على سطح غير ثابت
INSERT INTO patient_app.exercises (
  id, "nameAr", "nameEn", "descriptionAr", "descriptionEn",
  "bodyRegionId", "targetRegionId", "mediaType",
  "executionMethodAr", "executionMethodEn", "warningsAr", "warningsEn",
  "commonMistakesAr", "commonMistakesEn",
  "defaultDurationSeconds", "defaultSets", "defaultReps", "defaultHoldSeconds", "defaultRestSeconds",
  active, "createdByUserId", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'الوقوف على سطح غير ثابت', 'Standing on an Unstable Surface', 'وضعية البداية: الوقوف على وسادة أو سطح إسفنجي ثابت وآمن مع وجود دعم قريب.', 'Starting position: Stand on a cushion or a stable, safe foam surface with support nearby.',
  'seed-body-region-lumbar-spine', '7c69e365-2b61-4be2-998f-663d5ee62f53', 'VIDEO',
  'حافظ على توازن الجسم والجذع أثناء الوقوف على السطح غير الثابت. مدة التثبيت: 20–30 ثانية.', 'Keep the body and trunk balanced while standing on the unstable surface. Hold: 20–30 seconds.', 'استخدم الدعم القريب عند الحاجة لتقليل خطر فقدان التوازن.', 'Use the nearby support when needed to reduce the risk of losing balance.',
  NULL, NULL,
  NULL, 3, NULL, 20, NULL,
  true, (SELECT id FROM users.users WHERE username = 'admin' LIMIT 1), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM patient_app.exercises WHERE "nameAr" = 'الوقوف على سطح غير ثابت' AND "deletedAt" IS NULL
);
COMMIT;

SELECT COUNT(*) AS "عدد تمارين العمود القطني" FROM patient_app.exercises WHERE "bodyRegionId" = 'seed-body-region-lumbar-spine' AND "deletedAt" IS NULL;