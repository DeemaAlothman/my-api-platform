-- قيمة جديدة فقط لـenum موجود — بمعزل بمايجريشن خاص فيها عن أي DDL تاني (قيد Postgres على ALTER TYPE)
ALTER TYPE "warehouse"."PurchaseInvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCEL_REQUESTED';
