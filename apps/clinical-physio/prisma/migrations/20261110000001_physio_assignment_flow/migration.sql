-- مسار تعيين معالج العلاج الفيزيائي بعد التحويل — عمود جديد فاضٍ (افتراضياً false لكل
-- الحالات الموجودة) + جدول سجل تعيينات جديد بالكامل. صفر لمس لأي صف موجود
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN "awaitingAssignment" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "clinic_physio"."assignment_logs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedByName" TEXT,
    "therapistId" TEXT NOT NULL,
    "therapistName" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assignment_logs_caseId_idx" ON "clinic_physio"."assignment_logs"("caseId");

ALTER TABLE "clinic_physio"."assignment_logs" ADD CONSTRAINT "assignment_logs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "clinic_physio"."physio_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
