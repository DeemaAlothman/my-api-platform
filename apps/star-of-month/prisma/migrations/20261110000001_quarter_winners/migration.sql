-- نجم الربع — جدول جديد فقط، بدون لمس أي شي موجود
CREATE TABLE "star_of_month"."quarter_winners" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "company" TEXT NOT NULL,
    "employeeId" TEXT,
    "finalScore" DECIMAL(6,2) NOT NULL,
    "isTie" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certificateGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarter_winners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quarter_winners_year_quarter_company_key" ON "star_of_month"."quarter_winners"("year", "quarter", "company");
