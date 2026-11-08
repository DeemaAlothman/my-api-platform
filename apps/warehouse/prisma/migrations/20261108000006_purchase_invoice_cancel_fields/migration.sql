-- أعمدة جديدة فقط، كلها NULL افتراضياً — صفر تأثير على أي فاتورة موجودة
ALTER TABLE "warehouse"."purchase_invoices" ADD COLUMN "cancelRequestedByUserId" TEXT;
ALTER TABLE "warehouse"."purchase_invoices" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "warehouse"."purchase_invoices" ADD COLUMN "cancelRequestReason" TEXT;
ALTER TABLE "warehouse"."purchase_invoices" ADD COLUMN "statusBeforeCancelRequest" "warehouse"."PurchaseInvoiceStatus";
ALTER TABLE "warehouse"."purchase_invoices" ADD COLUMN "cancelledByUserId" TEXT;
ALTER TABLE "warehouse"."purchase_invoices" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "warehouse"."purchase_invoices" ADD COLUMN "cancellationReason" TEXT;
