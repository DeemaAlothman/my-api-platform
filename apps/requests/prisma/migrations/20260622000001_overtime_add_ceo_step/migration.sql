-- إضافة خطوة المدير التنفيذي (CEO) لمسار طلب العمل الإضافي
-- المسار الجديد: الموظف ← مدير مباشر ← HR ← CEO ← معتمد
SET search_path TO requests;

INSERT INTO approval_workflows (id, "requestType", "stepOrder", "approverRole", "isRequired", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'OVERTIME_EMPLOYEE', 3, 'CEO', true, NOW(), NOW())
ON CONFLICT ("requestType", "stepOrder") DO NOTHING;
