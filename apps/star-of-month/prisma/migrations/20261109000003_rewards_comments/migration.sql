-- مرحلة 3: المكافأة + الصورة + التعليقات + تذكير التصويت — إضافة أعمدة فاضية + جدول
-- تعليقات جديد. صفر لمس لأي صف موجود
ALTER TABLE "star_of_month"."cycles" ADD COLUMN "voteReminderSentAt" TIMESTAMP(3);

ALTER TABLE "star_of_month"."candidates" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "rewardType" TEXT;
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "rewardAmount" DECIMAL(10,2);
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "rewardLeaveDays" DECIMAL(5,2);
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "rewardedAt" TIMESTAMP(3);
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "historyRecordedAt" TIMESTAMP(3);

CREATE TABLE "star_of_month"."comments" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comments_candidateId_idx" ON "star_of_month"."comments"("candidateId");

ALTER TABLE "star_of_month"."comments" ADD CONSTRAINT "comments_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "star_of_month"."candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
