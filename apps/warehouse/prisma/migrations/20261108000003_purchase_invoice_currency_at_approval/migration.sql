-- نقل العملة والخصم من أمين المستودع للمدير المالي: تخفيف قيود NOT NULL فقط، صفر حذف/تعديل
-- على أي قيمة موجودة — كل الفواتير الحالية عندها عملة وسعر صرف فعلياً فما بتتأثر إطلاقاً
ALTER TABLE "warehouse"."purchase_invoices" ALTER COLUMN "currencyId" DROP NOT NULL;
ALTER TABLE "warehouse"."purchase_invoices" ALTER COLUMN "exchangeRate" DROP NOT NULL;
ALTER TABLE "warehouse"."purchase_invoice_items" ALTER COLUMN "baseUnitPrice" DROP NOT NULL;
