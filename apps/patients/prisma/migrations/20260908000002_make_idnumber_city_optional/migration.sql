-- الرقم الوطني والمدينة يصيران اختياريين عند إنشاء المريض
ALTER TABLE "clinic_patients"."patients" ALTER COLUMN "idNumber" DROP NOT NULL;
ALTER TABLE "clinic_patients"."patients" ALTER COLUMN "cityId" DROP NOT NULL;
