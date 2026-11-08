-- عمودان جديدان فاضيان افتراضياً — صفر تأثير على أي عرض موجود
ALTER TABLE "warehouse"."quotations" ADD COLUMN "discountApprovedByUserId" TEXT;
ALTER TABLE "warehouse"."quotations" ADD COLUMN "discountApprovedAt" TIMESTAMP(3);
