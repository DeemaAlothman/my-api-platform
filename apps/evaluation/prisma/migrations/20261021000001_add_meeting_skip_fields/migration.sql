ALTER TABLE "evaluation"."ProbationEvaluation" ADD COLUMN "meetingSkipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "evaluation"."ProbationEvaluation" ADD COLUMN "meetingSkippedAt" TIMESTAMP(3);
ALTER TABLE "evaluation"."ProbationEvaluation" ADD COLUMN "meetingSkippedBy" TEXT;
ALTER TABLE "evaluation"."ProbationEvaluation" ADD COLUMN "meetingSkipReason" TEXT;
