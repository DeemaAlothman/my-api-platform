-- تقييد ظهور نجم الشهر لـsuper_admin وHR/HR_Specialist فقط (مؤقتاً)
-- حذف view/vote من دور "موظف" العام
DELETE FROM users.role_permissions rp
USING users.roles r, users.permissions p
WHERE rp."roleId" = r.id
  AND rp."permissionId" = p.id
  AND r.name = 'موظف'
  AND p.name IN ('star_of_month.view', 'star_of_month.vote');

-- منح view + nominate + moderate_comments لدوري HR و HR_Specialist
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name IN ('HR', 'HR_Specialist')
  AND p.name IN ('star_of_month.view', 'star_of_month.nominate', 'star_of_month.moderate_comments')
ON CONFLICT DO NOTHING;
