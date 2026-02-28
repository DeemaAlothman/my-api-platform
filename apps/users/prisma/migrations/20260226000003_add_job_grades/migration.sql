-- CreateTable
CREATE TABLE "users"."job_grades" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "color" TEXT,
    "minSalary" DECIMAL(15,2),
    "maxSalary" DECIMAL(15,2),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_grades_code_key" ON "users"."job_grades"("code");

-- AlterTable
ALTER TABLE "users"."job_titles" ADD COLUMN "gradeId" TEXT;

-- AddForeignKey
ALTER TABLE "users"."job_titles" ADD CONSTRAINT "job_titles_gradeId_fkey"
  FOREIGN KEY ("gradeId") REFERENCES "users"."job_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
