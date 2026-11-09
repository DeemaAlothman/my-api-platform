CREATE SCHEMA IF NOT EXISTS "star_of_month";

CREATE TYPE "star_of_month"."CycleStatus" AS ENUM ('NOMINATING', 'VOTING', 'CLOSED');
CREATE TYPE "star_of_month"."CandidateSource" AS ENUM ('AUTO', 'HR');

CREATE TABLE "star_of_month"."cycles" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "star_of_month"."CycleStatus" NOT NULL DEFAULT 'NOMINATING',
    "nominationGeneratedAt" TIMESTAMP(3),
    "votingOpensAt" TIMESTAMP(3),
    "votingClosesAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cycles_year_month_key" ON "star_of_month"."cycles"("year", "month");

CREATE TABLE "star_of_month"."candidates" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "source" "star_of_month"."CandidateSource" NOT NULL DEFAULT 'AUTO',
    "latenessScore" DECIMAL(5,2),
    "leaveScore" DECIMAL(5,2),
    "substituteScore" DECIMAL(5,2),
    "autoScoreTotal" DECIMAL(5,2),
    "lateMinutesTotal" INTEGER,
    "leaveUnitsTotal" DECIMAL(8,2),
    "substituteCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "candidates_cycleId_company_employeeId_key" ON "star_of_month"."candidates"("cycleId", "company", "employeeId");
CREATE INDEX "candidates_cycleId_company_idx" ON "star_of_month"."candidates"("cycleId", "company");

ALTER TABLE "star_of_month"."candidates" ADD CONSTRAINT "candidates_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "star_of_month"."cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
