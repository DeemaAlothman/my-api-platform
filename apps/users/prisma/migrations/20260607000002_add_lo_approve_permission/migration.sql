SET search_path TO users;

-- صلاحية المسؤول اللوجستي (قرار طلبات الصيانة)
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'requests:lo-approve', 'موافقة المسؤول اللوجستي', 'Logistics officer maintenance decision', 'requests', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
