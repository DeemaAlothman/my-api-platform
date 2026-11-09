-- قيمة جديدة فقط لـenum موجود — بمعزل بملف خاص فيها (نفس قاعدة أي تعديل على enum بهالمشروع)
ALTER TYPE "cashbox"."CashTransactionType" ADD VALUE IF NOT EXISTS 'DEPOSIT';
