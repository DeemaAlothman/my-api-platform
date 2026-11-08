-- إعدادات التسعير صارت عامة (صف واحد يُطبَّق على كل القطع) بدل إعداد لكل قطعة لحالها.
-- حذف الجدول القديم (item_pricing_markups) — فيه حالياً بس صفوف تجربة من اليوم (لا بيانات
-- إنتاج فعلية)، وإنشاء الجدول الجديد العام فاضي
DROP TABLE IF EXISTS "warehouse"."item_pricing_markups";

CREATE TABLE "warehouse"."prosthetics_pricing_settings" (
    "id" TEXT NOT NULL,
    "priceBasis" "warehouse"."PriceBasis" NOT NULL DEFAULT 'LAST_PURCHASE',
    "markupAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "profitType" "warehouse"."ProfitType",
    "profitValue" DECIMAL(18,4),
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prosthetics_pricing_settings_pkey" PRIMARY KEY ("id")
);
