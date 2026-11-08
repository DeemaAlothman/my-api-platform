-- حقلين جديدين فاضيين لإعدادات التسعير (ربح ثابت أو نسبة، إضافي فوق القيمة الثابتة الموجودة) —
-- صفر تأثير على أي سطر موجود
CREATE TYPE "warehouse"."ProfitType" AS ENUM ('FIXED', 'PERCENT');

ALTER TABLE "warehouse"."item_pricing_markups" ADD COLUMN "profitType" "warehouse"."ProfitType";
ALTER TABLE "warehouse"."item_pricing_markups" ADD COLUMN "profitValue" DECIMAL(18,4);
