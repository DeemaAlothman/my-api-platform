# 🚀 دليل النشر على السيرفر

## الخطوات السريعة (Quick Start)

### 1. تحضير وسحب التحديثات
```bash
cd /path/to/my-api-platform
docker exec myapiplatform-postgres pg_dump -U postgres platform > backup_$(date +%Y%m%d).sql
git pull origin main
```

### 2. تحديث قاعدة البيانات
```bash
docker exec myapiplatform-users npx prisma db push
```

### 3. إضافة Permissions
```bash
docker exec myapiplatform-postgres psql -U postgres -d platform << 'SQLEOF'
INSERT INTO users.role_permissions ("roleId", "permissionId")
SELECT r.id, p.id FROM users.roles r CROSS JOIN users.permissions p
WHERE r.name = 'employee' AND p.name = 'attendance.alerts.read-own'
ON CONFLICT DO NOTHING;

INSERT INTO users.permissions (id, name, "displayName", module, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'roles:delete', 'حذف الأدوار', 'roles', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO users.role_permissions ("roleId", "permissionId")
SELECT r.id, p.id FROM users.roles r CROSS JOIN users.permissions p
WHERE r.name = 'super_admin' AND p.name = 'roles:delete'
ON CONFLICT DO NOTHING;
SQLEOF
```

### 4. إعادة بناء الخدمات
```bash
docker-compose build users leave
docker-compose up -d users leave
```

### 5. التحقق
```bash
docker ps --filter "name=myapiplatform" --format "table {{.Names}}\t{{.Status}}"
docker logs myapiplatform-users --tail 20
docker logs myapiplatform-leave --tail 20
```

---

## ✅ Checklist
- [ ] Backup قاعدة البيانات
- [ ] git pull نجح
- [ ] prisma db push نجح
- [ ] SQL permissions نجحت
- [ ] Docker rebuild نجح
- [ ] الخدمات بدأت بنجاح

Commit: 890f573

