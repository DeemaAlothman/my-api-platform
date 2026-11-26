-- حالةُ الحركة ومسارُ قرارها. إضافةٌ محضة: الحركاتُ القائمة كلُّها منفَّذة، وهي
-- القيمةُ الافتراضية، فلا سطرَ يتغيّر معناه ولا رصيدَ يتبدَّل بتطبيق هذا الترحيل.
-- النوعُ لا يَقبل IF NOT EXISTS فيُلَفُّ إنشاؤه، ليبقى الترحيلُ قابلاً للإعادة.
DO $$
BEGIN
  CREATE TYPE cashbox."CashTransactionStatus" AS ENUM
    ('COMPLETED', 'PENDING_CEO_APPROVAL', 'PENDING_RECEIPT', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE cashbox.cash_transactions
  ADD COLUMN IF NOT EXISTS status cashbox."CashTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "decidedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "decidedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectReason"    TEXT;

-- الفلترةُ على المعلَّق تُستعمل في كل عرضٍ لصندوق («بانتظار الاستلام»، «قيد التسليم»)
CREATE INDEX IF NOT EXISTS "cash_transactions_status_idx"
  ON cashbox.cash_transactions (status);
