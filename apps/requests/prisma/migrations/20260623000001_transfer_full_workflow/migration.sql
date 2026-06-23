SET search_path TO requests;

-- حذف المسار القديم للنقل (DM → HR)
DELETE FROM approval_workflows WHERE "requestType" = 'TRANSFER';

-- المسار الجديد: DM → مدير القسم الجديد → HR → CEO
INSERT INTO approval_workflows (id, "requestType", "stepOrder", "approverRole", "isRequired", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'TRANSFER', 1, 'DIRECT_MANAGER',   true, NOW(), NOW()),
  (gen_random_uuid()::text, 'TRANSFER', 2, 'TARGET_MANAGER',   true, NOW(), NOW()),
  (gen_random_uuid()::text, 'TRANSFER', 3, 'HR',               true, NOW(), NOW()),
  (gen_random_uuid()::text, 'TRANSFER', 4, 'CEO',              true, NOW(), NOW());
