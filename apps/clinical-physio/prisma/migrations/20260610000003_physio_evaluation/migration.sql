-- جدول الملاحظات والتقييم (Notes & Evaluation) — إضافي بحت، آمن
CREATE TABLE IF NOT EXISTS "clinic_physio"."physio_evaluations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "modalities" "clinic_physio"."TherapyModality"[] DEFAULT ARRAY[]::"clinic_physio"."TherapyModality"[],
    "otherModality" TEXT,
    "notes" TEXT,
    "evaluation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "physio_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "physio_evaluations_caseId_key" ON "clinic_physio"."physio_evaluations"("caseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'physio_evaluations_caseId_fkey'
      AND table_schema = 'clinic_physio'
  ) THEN
    ALTER TABLE "clinic_physio"."physio_evaluations"
      ADD CONSTRAINT "physio_evaluations_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "clinic_physio"."physio_cases"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
