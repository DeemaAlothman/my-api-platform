-- ماركةُ المادة ومورِّدُها. إضافةٌ محضة: خانتان فارغتان إلى جانب الخانات القائمة،
-- لا تمسّان مادةً من الموجودات ولا تُغيِّران رصيداً، ولا تَكسران شاشةً قائمة —
-- فالواجهةُ الحالية لا تَقرؤهما حتى تُضيفهما.
--
-- الماركةُ («ماليزي»، «3 inch») كانت تُدمَج في الاسم وحدَه فلا تُفرَز ولا يُجمَع
-- عليها. والمورِّدُ كان مرتبطاً بفواتير الشراء فقط، فسؤالُ «نفدت المادة، من أين
-- نشتريها؟» لم يكن للنظام جوابٌ عنه.
ALTER TABLE warehouse.items
  ADD COLUMN IF NOT EXISTS "brand"      TEXT,
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

DO $$
BEGIN
  ALTER TABLE warehouse.items
    ADD CONSTRAINT "items_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES warehouse.suppliers("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "items_supplierId_idx" ON warehouse.items ("supplierId");
