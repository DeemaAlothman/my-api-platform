-- صلاحية الموافقة على أمر صرف من الصندوق أو رفضه — إدراج فقط، ولا تُسنَد لأي دور
-- تلقائياً: تُعطى من شاشة الصلاحيات للمدير التنفيذي. وعليها يُبنى أيضاً مَن يُشعَر
-- بطلبات الصرف المنتظِرة، فإن لم تُسنَد لأحدٍ بقي الطلبُ معلَّقاً بلا من يراه.
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'cashbox.ceo-approve', 'الموافقة على صرف من الصندوق', 'Approve or reject a cash disbursement order', 'cashbox', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
