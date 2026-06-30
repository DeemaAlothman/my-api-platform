-- إضافة جدول سجل نقل العهد بين الموظفين (تاريخ الاستلام من القديم + تاريخ التسليم للجديد)
-- لا يلمس أي جدول موجود ولا يحذف أي بيانات

CREATE TABLE "users"."custody_transfers" (
    "id" TEXT NOT NULL,
    "custodyId" TEXT NOT NULL,
    "fromEmployeeId" TEXT NOT NULL,
    "toEmployeeId" TEXT NOT NULL,
    "returnedDate" TIMESTAMP(3) NOT NULL,
    "handoverDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "transferredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custody_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custody_transfers_custodyId_idx" ON "users"."custody_transfers"("custodyId");
CREATE INDEX "custody_transfers_fromEmployeeId_idx" ON "users"."custody_transfers"("fromEmployeeId");
CREATE INDEX "custody_transfers_toEmployeeId_idx" ON "users"."custody_transfers"("toEmployeeId");

ALTER TABLE "users"."custody_transfers" ADD CONSTRAINT "custody_transfers_custodyId_fkey"
    FOREIGN KEY ("custodyId") REFERENCES "users"."custodies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
