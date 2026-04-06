-- Add Onboarding / Offboarding workflow system

SET search_path TO users;

-- Enums
CREATE TYPE "WorkflowType" AS ENUM ('ONBOARDING', 'OFFBOARDING');
CREATE TYPE "WorkflowStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');
CREATE TYPE "TaskAssignee" AS ENUM ('HR', 'IT', 'MANAGER', 'EMPLOYEE', 'OTHER');

-- Templates
CREATE TABLE onboarding_templates (
  id          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  type        "WorkflowType" NOT NULL,
  "nameAr"    TEXT         NOT NULL,
  "nameEn"    TEXT         NOT NULL,
  description TEXT,
  "isDefault" BOOLEAN      NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT onboarding_templates_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_onboarding_templates_type ON onboarding_templates (type);

-- Template Tasks
CREATE TABLE onboarding_template_tasks (
  id              TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  "templateId"    TEXT           NOT NULL,
  "titleAr"       TEXT           NOT NULL,
  "titleEn"       TEXT           NOT NULL,
  "descriptionAr" TEXT,
  "descriptionEn" TEXT,
  "assignedTo"    "TaskAssignee" NOT NULL,
  "order"         INTEGER        NOT NULL DEFAULT 0,
  "daysFromStart" INTEGER        NOT NULL DEFAULT 0,
  CONSTRAINT onboarding_template_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT onboarding_template_tasks_template_fk
    FOREIGN KEY ("templateId") REFERENCES onboarding_templates(id) ON DELETE CASCADE
);
CREATE INDEX idx_onboarding_template_tasks_template ON onboarding_template_tasks ("templateId");

-- Workflows
CREATE TABLE onboarding_workflows (
  id            TEXT             NOT NULL DEFAULT gen_random_uuid()::text,
  "employeeId"  TEXT             NOT NULL,
  "templateId"  TEXT             NOT NULL,
  type          "WorkflowType"   NOT NULL,
  status        "WorkflowStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startDate"   TIMESTAMP(3)     NOT NULL,
  "targetDate"  TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  notes         TEXT,
  "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP(3)     NOT NULL DEFAULT NOW(),
  CONSTRAINT onboarding_workflows_pkey PRIMARY KEY (id),
  CONSTRAINT onboarding_workflows_employee_fk
    FOREIGN KEY ("employeeId") REFERENCES employees(id),
  CONSTRAINT onboarding_workflows_template_fk
    FOREIGN KEY ("templateId") REFERENCES onboarding_templates(id)
);
CREATE INDEX idx_onboarding_workflows_employee ON onboarding_workflows ("employeeId");
CREATE INDEX idx_onboarding_workflows_status   ON onboarding_workflows (status);

-- Workflow Tasks
CREATE TABLE onboarding_workflow_tasks (
  id               TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  "workflowId"     TEXT           NOT NULL,
  "templateTaskId" TEXT           NOT NULL,
  "titleAr"        TEXT           NOT NULL,
  "titleEn"        TEXT           NOT NULL,
  "assignedTo"     "TaskAssignee" NOT NULL,
  "assignedUserId" TEXT,
  status           "TaskStatus"   NOT NULL DEFAULT 'PENDING',
  "dueDate"        TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  notes            TEXT,
  CONSTRAINT onboarding_workflow_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT onboarding_workflow_tasks_workflow_fk
    FOREIGN KEY ("workflowId") REFERENCES onboarding_workflows(id) ON DELETE CASCADE,
  CONSTRAINT onboarding_workflow_tasks_template_task_fk
    FOREIGN KEY ("templateTaskId") REFERENCES onboarding_template_tasks(id)
);
CREATE INDEX idx_onboarding_workflow_tasks_workflow ON onboarding_workflow_tasks ("workflowId");
CREATE INDEX idx_onboarding_workflow_tasks_status   ON onboarding_workflow_tasks (status);
