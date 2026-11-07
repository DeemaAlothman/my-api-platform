-- متى انبعث إشعار "انتهى التفويض" — عمود جديد اختياري فقط، بلا أي لمس للبيانات الموجودة
ALTER TABLE "delegations" ADD COLUMN "endNotifiedAt" TIMESTAMP(3);
