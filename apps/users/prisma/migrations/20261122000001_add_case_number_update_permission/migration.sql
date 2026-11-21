-- صلاحية تعديل رقم حالة الأطراف الصناعية يدوياً — إدراج فقط، ولا تُسنَد لأي دور
-- تلقائياً: تُعطى من شاشة الصلاحيات لأشخاص محدّدين.
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'clinic.prosthetics.case.number.update', 'تعديل رقم حالة الأطراف', 'Manually change a prosthetics case number', 'clinic_prosthetics', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
