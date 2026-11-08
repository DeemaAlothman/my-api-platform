-- جدول جديد بالكامل لتخزين "الرقم الثابت" وأساس التسعير لكل قطعة — صفر لمس لأي جدول موجود
CREATE TYPE "warehouse"."PriceBasis" AS ENUM ('LAST_PURCHASE', 'HIGHEST_PURCHASE');

CREATE TABLE "warehouse"."item_pricing_markups" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "priceBasis" "warehouse"."PriceBasis" NOT NULL DEFAULT 'LAST_PURCHASE',
    "markupAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_pricing_markups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_pricing_markups_itemId_key" ON "warehouse"."item_pricing_markups"("itemId");

ALTER TABLE "warehouse"."item_pricing_markups"
  ADD CONSTRAINT "item_pricing_markups_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
