-- صلاحية إيداع/رصيد افتتاحي بالصندوق — إدراج فقط، بدون تعديل أو حذف أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'cashbox.transactions.deposit', 'إيداع رصيد افتتاحي/رأس مال بالصندوق', 'Deposit opening balance / capital into a cash box', 'cashbox', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- منح الصلاحية لـsuper_admin + المدير المالي (CFO)
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name IN ('super_admin', 'CFO')
  AND p.name = 'cashbox.transactions.deposit'
ON CONFLICT DO NOTHING;
