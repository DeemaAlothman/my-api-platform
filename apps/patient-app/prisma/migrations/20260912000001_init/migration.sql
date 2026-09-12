-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "patient_app";

-- CreateEnum
CREATE TYPE "patient_app"."PatientAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "patient_app"."PatientAccountSource" AS ENUM ('APP', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "patient_app"."MediaType" AS ENUM ('VIDEO', 'IMAGE', 'ANIMATION');

-- CreateEnum
CREATE TYPE "patient_app"."AssignmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "patient_app"."ExecutionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "patient_app"."patient_accounts" (
    "id" TEXT NOT NULL,
    "erpPatientId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "patient_app"."PatientAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdSource" "patient_app"."PatientAccountSource" NOT NULL,
    "createdByUserId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "patient_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."patient_refresh_tokens" (
    "id" TEXT NOT NULL,
    "patientAccountId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."body_regions" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."target_regions" (
    "id" TEXT NOT NULL,
    "bodyRegionId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."sub_target_regions" (
    "id" TEXT NOT NULL,
    "targetRegionId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_target_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."exercise_goals" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."exercises" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "bodyRegionId" TEXT NOT NULL,
    "targetRegionId" TEXT NOT NULL,
    "subTargetRegionId" TEXT,
    "mediaType" "patient_app"."MediaType" NOT NULL,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "executionMethodAr" TEXT,
    "executionMethodEn" TEXT,
    "warningsAr" TEXT,
    "warningsEn" TEXT,
    "commonMistakesAr" TEXT,
    "commonMistakesEn" TEXT,
    "defaultDurationSeconds" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."exercise_goal_links" (
    "exerciseId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,

    CONSTRAINT "exercise_goal_links_pkey" PRIMARY KEY ("exerciseId","goalId")
);

-- CreateTable
CREATE TABLE "patient_app"."session_exercise_assignments" (
    "id" TEXT NOT NULL,
    "erpPatientId" TEXT NOT NULL,
    "erpSessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "erpTherapistId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "holdSeconds" INTEGER,
    "restSeconds" INTEGER,
    "frequencyTextAr" TEXT,
    "frequencyTextEn" TEXT,
    "customInstructionAr" TEXT,
    "customInstructionEn" TEXT,
    "status" "patient_app"."AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_exercise_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."exercise_executions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "patientAccountId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" "patient_app"."ExecutionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "skipReasonId" TEXT,
    "skipReasonText" TEXT,
    "completionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."skip_reasons" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skip_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_accounts_erpPatientId_key" ON "patient_app"."patient_accounts"("erpPatientId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_accounts_username_key" ON "patient_app"."patient_accounts"("username");

-- CreateIndex
CREATE INDEX "patient_accounts_erpPatientId_idx" ON "patient_app"."patient_accounts"("erpPatientId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_refresh_tokens_token_key" ON "patient_app"."patient_refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "patient_refresh_tokens_patientAccountId_idx" ON "patient_app"."patient_refresh_tokens"("patientAccountId");

-- CreateIndex
CREATE INDEX "target_regions_bodyRegionId_idx" ON "patient_app"."target_regions"("bodyRegionId");

-- CreateIndex
CREATE INDEX "sub_target_regions_targetRegionId_idx" ON "patient_app"."sub_target_regions"("targetRegionId");

-- CreateIndex
CREATE INDEX "exercises_bodyRegionId_idx" ON "patient_app"."exercises"("bodyRegionId");

-- CreateIndex
CREATE INDEX "exercises_targetRegionId_idx" ON "patient_app"."exercises"("targetRegionId");

-- CreateIndex
CREATE INDEX "session_exercise_assignments_erpSessionId_sortOrder_idx" ON "patient_app"."session_exercise_assignments"("erpSessionId", "sortOrder");

-- CreateIndex
CREATE INDEX "session_exercise_assignments_erpPatientId_idx" ON "patient_app"."session_exercise_assignments"("erpPatientId");

-- CreateIndex
CREATE INDEX "exercise_executions_assignmentId_idx" ON "patient_app"."exercise_executions"("assignmentId");

-- CreateIndex
CREATE INDEX "exercise_executions_patientAccountId_idx" ON "patient_app"."exercise_executions"("patientAccountId");

-- AddForeignKey
ALTER TABLE "patient_app"."patient_refresh_tokens" ADD CONSTRAINT "patient_refresh_tokens_patientAccountId_fkey" FOREIGN KEY ("patientAccountId") REFERENCES "patient_app"."patient_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."target_regions" ADD CONSTRAINT "target_regions_bodyRegionId_fkey" FOREIGN KEY ("bodyRegionId") REFERENCES "patient_app"."body_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."sub_target_regions" ADD CONSTRAINT "sub_target_regions_targetRegionId_fkey" FOREIGN KEY ("targetRegionId") REFERENCES "patient_app"."target_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."exercises" ADD CONSTRAINT "exercises_bodyRegionId_fkey" FOREIGN KEY ("bodyRegionId") REFERENCES "patient_app"."body_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."exercises" ADD CONSTRAINT "exercises_targetRegionId_fkey" FOREIGN KEY ("targetRegionId") REFERENCES "patient_app"."target_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."exercises" ADD CONSTRAINT "exercises_subTargetRegionId_fkey" FOREIGN KEY ("subTargetRegionId") REFERENCES "patient_app"."sub_target_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."exercise_goal_links" ADD CONSTRAINT "exercise_goal_links_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "patient_app"."exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."exercise_goal_links" ADD CONSTRAINT "exercise_goal_links_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "patient_app"."exercise_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."session_exercise_assignments" ADD CONSTRAINT "session_exercise_assignments_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "patient_app"."exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."exercise_executions" ADD CONSTRAINT "exercise_executions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "patient_app"."session_exercise_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."exercise_executions" ADD CONSTRAINT "exercise_executions_patientAccountId_fkey" FOREIGN KEY ("patientAccountId") REFERENCES "patient_app"."patient_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."exercise_executions" ADD CONSTRAINT "exercise_executions_skipReasonId_fkey" FOREIGN KEY ("skipReasonId") REFERENCES "patient_app"."skip_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

