-- السماح بعرض سعر/فاتورة لزبون مبيعات بدل مريض — تخفيف قيد + عمود جديد + فهرس، صفر لمس
-- لأي صف موجود (كل العروض/الفواتير الحالية عندها patientId فعلياً فبتضل تماماً متل ما هي)
ALTER TABLE "warehouse"."quotations" ALTER COLUMN "patientId" DROP NOT NULL;
ALTER TABLE "warehouse"."quotations" ADD COLUMN "customerId" TEXT;
CREATE INDEX "quotations_customerId_idx" ON "warehouse"."quotations"("customerId");

ALTER TABLE "warehouse"."sales_invoices" ALTER COLUMN "patientId" DROP NOT NULL;
ALTER TABLE "warehouse"."sales_invoices" ADD COLUMN "customerId" TEXT;
CREATE INDEX "sales_invoices_customerId_idx" ON "warehouse"."sales_invoices"("customerId");
