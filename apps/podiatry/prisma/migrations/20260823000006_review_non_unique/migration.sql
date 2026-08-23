SET search_path TO clinic_podiatry;

-- إزالة الـ unique constraint لأن الاستقبال ممكن يكون فيه أكثر من مراجعة
ALTER TABLE podiatry_reviews DROP CONSTRAINT IF EXISTS podiatry_reviews_receptionId_key;
