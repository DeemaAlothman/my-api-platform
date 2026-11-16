-- تقييم 360 درجة — إضافة فقط: أنواع وجداول جديدة. لا يلمس أي جدول موجود.

-- CreateEnum
CREATE TYPE "evaluation"."AppraisalAxis" AS ENUM ('MANAGER', 'CUSTOMER', 'PEER', 'UPWARD', 'COMMITMENT', 'SELF');

-- CreateEnum
CREATE TYPE "evaluation"."AppraisalCycleStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "evaluation"."AppraisalSatisfactionSource" AS ENUM ('PROSTHETICS', 'PHYSIO', 'PODIATRY');

-- CreateEnum
CREATE TYPE "evaluation"."AppraisalSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "evaluation"."AppraisalBonusTier" AS ENUM ('EXCEPTIONAL', 'HIGH', 'BASIC', 'PIP');

-- CreateTable
CREATE TABLE "evaluation"."AppraisalCycle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "evaluation"."AppraisalCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "finalizedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppraisalCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."AppraisalQuestion" (
    "id" TEXT NOT NULL,
    "axis" "evaluation"."AppraisalAxis" NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "textAr" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppraisalQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."AppraisalSubmission" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "axis" "evaluation"."AppraisalAxis" NOT NULL,
    "evaluateeId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "status" "evaluation"."AppraisalSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "comments" TEXT,
    "achievementNote" TEXT,
    "achievementFileUrl" TEXT,
    "scorePercent" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppraisalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."AppraisalAnswer" (
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "AppraisalAnswer_pkey" PRIMARY KEY ("submissionId","questionId")
);

-- CreateTable
CREATE TABLE "evaluation"."AppraisalDepartmentConfig" (
    "departmentId" TEXT NOT NULL,
    "satisfactionSource" "evaluation"."AppraisalSatisfactionSource",
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppraisalDepartmentConfig_pkey" PRIMARY KEY ("departmentId")
);

-- CreateTable
CREATE TABLE "evaluation"."AppraisalReadinessJobTitle" (
    "jobTitleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppraisalReadinessJobTitle_pkey" PRIMARY KEY ("jobTitleId")
);

-- CreateTable
CREATE TABLE "evaluation"."AppraisalSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "penaltyPoints" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "justificationPoints" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "excessLeaveDayPoints" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "excessLeaveHourPoints" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "starOfMonthPoints" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "monthlyLeaveDaysAllowance" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "monthlyLeaveHoursAllowance" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "countedLeaveTypeCodes" TEXT[],
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppraisalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."AppraisalResult" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "managerPercent" DOUBLE PRECISION,
    "customerPercent" DOUBLE PRECISION,
    "peerPercent" DOUBLE PRECISION,
    "upwardPercent" DOUBLE PRECISION,
    "commitmentPercent" DOUBLE PRECISION,
    "selfPercent" DOUBLE PRECISION,
    "peerCount" INTEGER NOT NULL DEFAULT 0,
    "upwardCount" INTEGER NOT NULL DEFAULT 0,
    "appliedWeights" JSONB NOT NULL,
    "missingAxes" TEXT[],
    "details" JSONB NOT NULL,
    "finalScore" DOUBLE PRECISION,
    "bonusTier" "evaluation"."AppraisalBonusTier",
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppraisalResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalCycle_code_key" ON "evaluation"."AppraisalCycle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalQuestion_axis_displayOrder_key" ON "evaluation"."AppraisalQuestion"("axis", "displayOrder");

-- CreateIndex
CREATE INDEX "AppraisalSubmission_cycleId_evaluateeId_idx" ON "evaluation"."AppraisalSubmission"("cycleId", "evaluateeId");

-- CreateIndex
CREATE INDEX "AppraisalSubmission_cycleId_evaluatorId_idx" ON "evaluation"."AppraisalSubmission"("cycleId", "evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalSubmission_cycleId_axis_evaluateeId_evaluatorId_key" ON "evaluation"."AppraisalSubmission"("cycleId", "axis", "evaluateeId", "evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalResult_cycleId_employeeId_key" ON "evaluation"."AppraisalResult"("cycleId", "employeeId");

-- AddForeignKey
ALTER TABLE "evaluation"."AppraisalSubmission" ADD CONSTRAINT "AppraisalSubmission_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "evaluation"."AppraisalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."AppraisalAnswer" ADD CONSTRAINT "AppraisalAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "evaluation"."AppraisalSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."AppraisalAnswer" ADD CONSTRAINT "AppraisalAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "evaluation"."AppraisalQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."AppraisalResult" ADD CONSTRAINT "AppraisalResult_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "evaluation"."AppraisalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── أسئلة الدليل (ثابتة) ────────────────────────────────────────────────────
INSERT INTO "evaluation"."AppraisalQuestion" ("id", "axis", "displayOrder", "textAr", "maxScore") VALUES
  ('aq-mgr-01', 'MANAGER', 1,  'إنجاز المستهدفات الشهرية ونصف السنوية بشكل كامل', 10),
  ('aq-mgr-02', 'MANAGER', 2,  'جودة التنفيذ الفني وخلوه التام من الهدر خلال 6 أشهر', 10),
  ('aq-mgr-03', 'MANAGER', 3,  'احترام النظام الإداري والتسلسل الهرمي في الإجازات والطلبات', 5),
  ('aq-mgr-04', 'MANAGER', 4,  'التعامل باحترام مع الزملاء والإدارة عند اختلاف وجهات النظر', 5),
  ('aq-mgr-05', 'MANAGER', 5,  'خلق جو إيجابي ومبادرة دعم الزملاء وقت الذروة', 5),
  ('aq-mgr-06', 'MANAGER', 6,  'تجنب الشائعات والأحاديث الشخصية والجانبية الضارة', 5),
  ('aq-mgr-07', 'MANAGER', 7,  'المحافظة الصارمة على أسرار القسم والعمل', 5),
  ('aq-mgr-08', 'MANAGER', 8,  'التعامل المسؤول مع أصول وموارد الشركة ووقت العمل', 5),
  ('aq-mgr-09', 'MANAGER', 9,  'الإدخالات الحاسوبية والرقمية والتقارير بلا تأخير أو مماطلة', 5),
  ('aq-mgr-10', 'MANAGER', 10, 'استحقاق الموظف للترقية مستقبلاً إذا سمحت الفرصة', 3),
  ('aq-peer-1', 'PEER', 1, 'التعاون بسلاسة في إنجاز العمليات اليومية بين الأقسام', 5),
  ('aq-peer-2', 'PEER', 2, 'احترام التسلسل الوظيفي ولغة المراسلات', 5),
  ('aq-peer-3', 'PEER', 3, 'المبادرة بتقديم الدعم للزملاء وقت ذروة العمل', 5),
  ('aq-peer-4', 'PEER', 4, 'التواصل بلغة هادئة وراقية بلا فوقية أو عجرفة', 5),
  ('aq-up-1', 'UPWARD', 1, 'التعامل بعدل وشفافية واضحة مع المرؤوسين', 5),
  ('aq-up-2', 'UPWARD', 2, 'توفير التوجيه والدعم المهني لتطوير الموظف', 5),
  ('aq-up-3', 'UPWARD', 3, 'السعي لتوفير الموارد والمواد اللازمة لتسهيل العمل', 5),
  ('aq-up-4', 'UPWARD', 4, 'التعامل مع المقترحات برحابة صدر', 5),
  ('aq-up-5', 'UPWARD', 5, 'الاستماع الجدي للمشاكل وإيجاد حلول مناسبة', 5),
  ('aq-up-6', 'UPWARD', 6, 'التواصل بلغة مهنية ولبقة ومحترمة', 5),
  ('aq-self-1', 'SELF', 1, 'مدى الرضا عن النتائج وتطور الأداء', 5),
  ('aq-self-2', 'SELF', 2, 'مدى إضافة قيمة حقيقية للقسم', 5),
  ('aq-self-3', 'SELF', 3, 'دقة النتائج وخلوها من الأخطاء', 5),
  ('aq-self-4', 'SELF', 4, 'الالتزام بأنظمة الشركة وساعات الدوام بلا تجاوزات', 5);

-- ── قرار HR رقم 1: أرقام مؤشر الالتزام ─────────────────────────────────────
-- الإجازات اليومية المحتسبة ضمن السماحية: الاختيارية فقط (سنوية/طارئة/بلا راتب).
-- المرضية والأمومة والوفاة والزواج والحج… لا تُحتسب تجاوزاً.
INSERT INTO "evaluation"."AppraisalSettings"
  ("id", "penaltyPoints", "justificationPoints", "excessLeaveDayPoints", "excessLeaveHourPoints",
   "starOfMonthPoints", "monthlyLeaveDaysAllowance", "monthlyLeaveHoursAllowance", "countedLeaveTypeCodes", "updatedAt")
VALUES (1, 1, 0.25, 0.5, 0.25, 1, 1, 2, ARRAY['ANNUAL','EMERGENCY','UNPAID','UNPAID_DAILY'], CURRENT_TIMESTAMP);
