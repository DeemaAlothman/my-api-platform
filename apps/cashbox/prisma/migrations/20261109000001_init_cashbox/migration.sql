CREATE SCHEMA IF NOT EXISTS "cashbox";

CREATE TYPE "cashbox"."CashBoxType" AS ENUM ('MAIN', 'SUB');
CREATE TYPE "cashbox"."CashTransactionType" AS ENUM ('DISBURSEMENT', 'RECEIPT', 'HANDOVER', 'REFILL');

CREATE TABLE "cashbox"."currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "currencies_code_key" ON "cashbox"."currencies"("code");

CREATE TABLE "cashbox"."cash_boxes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "cashbox"."CashBoxType" NOT NULL DEFAULT 'SUB',
    "custodianEmployeeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_boxes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cashbox"."cash_transactions" (
    "id" TEXT NOT NULL,
    "cashBoxId" TEXT NOT NULL,
    "transactionType" "cashbox"."CashTransactionType" NOT NULL,
    "relatedCashBoxId" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "reason" TEXT,
    "targetEmployeeId" TEXT,
    "patientId" TEXT,
    "customerId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cash_transactions_cashBoxId_idx" ON "cashbox"."cash_transactions"("cashBoxId");
CREATE INDEX "cash_transactions_relatedCashBoxId_idx" ON "cashbox"."cash_transactions"("relatedCashBoxId");
CREATE INDEX "cash_transactions_transactionType_idx" ON "cashbox"."cash_transactions"("transactionType");

CREATE TABLE "cashbox"."cash_counts" (
    "id" TEXT NOT NULL,
    "cashBoxId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "expectedBalance" DECIMAL(18,4) NOT NULL,
    "actualBalance" DECIMAL(18,4) NOT NULL,
    "variance" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "countedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_counts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cash_counts_cashBoxId_idx" ON "cashbox"."cash_counts"("cashBoxId");

ALTER TABLE "cashbox"."cash_transactions" ADD CONSTRAINT "cash_transactions_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "cashbox"."cash_boxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cashbox"."cash_transactions" ADD CONSTRAINT "cash_transactions_relatedCashBoxId_fkey" FOREIGN KEY ("relatedCashBoxId") REFERENCES "cashbox"."cash_boxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cashbox"."cash_transactions" ADD CONSTRAINT "cash_transactions_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "cashbox"."currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cashbox"."cash_counts" ADD CONSTRAINT "cash_counts_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "cashbox"."cash_boxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cashbox"."cash_counts" ADD CONSTRAINT "cash_counts_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "cashbox"."currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
