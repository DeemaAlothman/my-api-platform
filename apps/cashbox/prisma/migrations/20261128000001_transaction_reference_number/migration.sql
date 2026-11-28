-- رقمٌ مرجعيٌّ مقروء لكل حركة (CB-2026-0001) وعدّادُه. إضافةٌ محضة: خانةٌ فارغة
-- وجدولٌ جديد، لا تُمَسُّ قيمةٌ مكتوبة ولا يتبدَّل رصيد.
-- وتعبئةُ الحركات السابقة عملٌ منفصلٌ يُنفَّذ بعد التحقُّق، لا جزءٌ من هذا الترحيل.
ALTER TABLE cashbox.cash_transactions
  ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;

-- الفرادةُ شرطٌ لا زينة: مرجعٌ يَدُلُّ على حركتين ليس مرجعاً. وجزئيٌّ لأن
-- الحركاتَ السابقة تبقى فارغةً حتى تُعبَّأ، والفراغُ لا يَتعارض مع الفراغ.
CREATE UNIQUE INDEX IF NOT EXISTS "cash_transactions_referenceNumber_key"
  ON cashbox.cash_transactions ("referenceNumber")
  WHERE "referenceNumber" IS NOT NULL;

-- سطرٌ لكل سنة. يُحجَز الرقمُ بزيادةٍ ذرّيةٍ عليه داخل معاملة الإنشاء، لا بقراءة
-- أكبرِ رقمٍ ثم الزيادة: فطلبان متزامنان لا يَتنازعان رقماً واحداً.
CREATE TABLE IF NOT EXISTS cashbox.reference_counters (
  "year"      INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("year")
);
