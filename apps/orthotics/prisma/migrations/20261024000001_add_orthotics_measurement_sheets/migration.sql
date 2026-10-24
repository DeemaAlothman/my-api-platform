-- CreateTable
CREATE TABLE "clinic_orthotics"."orthotics_measurement_sheets" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "sheet" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "notes" TEXT,
    "values" JSONB NOT NULL,
    "examinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "orthotics_measurement_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orthotics_measurement_sheets_receptionId_idx" ON "clinic_orthotics"."orthotics_measurement_sheets"("receptionId");

-- AddForeignKey
ALTER TABLE "clinic_orthotics"."orthotics_measurement_sheets" ADD CONSTRAINT "orthotics_measurement_sheets_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "clinic_orthotics"."orthotics_receptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
