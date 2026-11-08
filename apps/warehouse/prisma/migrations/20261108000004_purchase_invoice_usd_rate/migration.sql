-- إضافة حقل فقط لحفظ سعر صرف الدولار المجمَّد لحظة الاعتماد (لحساب totalUSD) — نفسه
-- NULL افتراضياً لكل الفواتير الحالية، صفر تأثير على أي بيانات موجودة
ALTER TABLE "warehouse"."purchase_invoices" ADD COLUMN "usdExchangeRate" DECIMAL(18,8);
