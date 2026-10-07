-- قائمة المواهب: جدول جديد فقط، لا يلمس أي جدول موجود
CREATE TABLE "jobs"."talent_flags" (
    "jobApplicationId" TEXT NOT NULL,
    "markedBy" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "talent_flags_pkey" PRIMARY KEY ("jobApplicationId")
);
