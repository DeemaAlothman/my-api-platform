-- لقطةُ الرصيد قبل الحركة وبعدها، لكل صندوقٍ تمسُّه. إضافةٌ محضة: أربعُ خاناتٍ
-- فارغةٍ إلى جانب الخانات القائمة، لا تمسُّ قيمةً مكتوبةً ولا تُغيِّر رصيداً —
-- الرصيدُ يُحسَب من الحركات كما كان، وهذه شهادةٌ عليه لا مصدرٌ له.
-- وتعبئةُ الحركات السابقة عملٌ منفصلٌ يُنفَّذ بعد التحقُّق، لا جزءٌ من هذا الترحيل.
ALTER TABLE cashbox.cash_transactions
  ADD COLUMN IF NOT EXISTS "balanceBefore"            DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS "balanceAfter"             DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS "counterpartBalanceBefore" DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS "counterpartBalanceAfter"  DECIMAL(18, 4);
