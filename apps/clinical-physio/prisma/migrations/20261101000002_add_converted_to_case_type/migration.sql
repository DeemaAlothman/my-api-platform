-- القسم الذي حُوّلت إليه حالة المعاينة (PHYSIO | PROSTHETICS | PODIATRY | ORTHOTICS) — إضافة عمود فقط
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN "convertedToCaseType" TEXT;
