-- إضافة عمودين اختياريين (nullable) فقط — بدون أي تعديل أو حذف على أي عمود أو صف موجود.
-- كلاهما فاضٍ لكل السجلات الحالية والجديدة إلى أن يُفعَّل مسار خدمة warehouse الجديدة لاحقاً.
ALTER TABLE "clinic_prosthetics"."prosthesis_components" ADD COLUMN "warehouseItemId" TEXT;
ALTER TABLE "clinic_prosthetics"."prosthesis_components" ADD COLUMN "materialRequestId" TEXT;
