-- صلاحية إعادة فتح/قفل حالة الأطراف المسلَّمة — إدراج فقط
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'clinic.prosthetics.reopen', 'إعادة فتح حالة أطراف مسلَّمة', 'Reopen and relock a delivered prosthetics case', 'clinic_prosthetics', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
