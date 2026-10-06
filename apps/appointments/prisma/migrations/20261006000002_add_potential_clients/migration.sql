-- العملاء المحتملين: جدول جديد فقط، لا يلمس أي جدول موجود (يعيد استخدام enums الجنس وطريقة الوصول)
CREATE TABLE "clinic_appointments"."potential_clients" (
    "id" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "gender" "clinic_appointments"."Gender" NOT NULL,
    "age" INTEGER,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivalMethod" "clinic_appointments"."ArrivalMethod",
    "interestedService" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "potential_clients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "potential_clients_registrationDate_idx" ON "clinic_appointments"."potential_clients"("registrationDate");
