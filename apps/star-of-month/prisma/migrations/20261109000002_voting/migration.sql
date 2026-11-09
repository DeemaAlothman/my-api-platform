-- مرحلة 2: التصويت — إضافة أعمدة نتائج (فاضية حالياً) لجدول المرشحين الموجود، وجدول
-- أصوات جديد بالكامل. صفر لمس لأي صف أو عمود موجود
CREATE TYPE "star_of_month"."VoterRole" AS ENUM ('PEER', 'MANAGER', 'CEO');

ALTER TABLE "star_of_month"."candidates" ADD COLUMN "peerVoteCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "peerVoteScore" DECIMAL(5,2);
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "managerVoteReceived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "managerVoteScore" DECIMAL(5,2);
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "ceoVoteReceived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "ceoVoteScore" DECIMAL(5,2);
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "finalScore" DECIMAL(6,2);
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "isWinner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "star_of_month"."candidates" ADD COLUMN "wasTieBroken" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "star_of_month"."votes" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "voterEmployeeId" TEXT NOT NULL,
    "candidateEmployeeId" TEXT NOT NULL,
    "voterRole" "star_of_month"."VoterRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "votes_cycleId_company_voterEmployeeId_voterRole_key" ON "star_of_month"."votes"("cycleId", "company", "voterEmployeeId", "voterRole");
CREATE INDEX "votes_cycleId_company_idx" ON "star_of_month"."votes"("cycleId", "company");

ALTER TABLE "star_of_month"."votes" ADD CONSTRAINT "votes_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "star_of_month"."cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
