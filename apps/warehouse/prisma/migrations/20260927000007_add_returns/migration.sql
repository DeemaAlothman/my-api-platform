-- AlterEnum: قيمتان جديدتان لنوع الحركة (مرتجع صادر/وارد)
ALTER TYPE "warehouse"."MovementType" ADD VALUE 'RETURN_OUT';
ALTER TYPE "warehouse"."MovementType" ADD VALUE 'RETURN_IN';

-- CreateEnum
CREATE TYPE "warehouse"."ReturnType" AS ENUM ('PURCHASE_RETURN', 'SALES_RETURN', 'ISSUE_RETURN', 'PRODUCTION_RETURN');

-- CreateEnum
CREATE TYPE "warehouse"."ReturnCondition" AS ENUM ('GOOD', 'DAMAGED', 'INSPECT');

-- CreateTable
CREATE TABLE "warehouse"."returns" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "returnType" "warehouse"."ReturnType" NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT,
    "sourceReferenceType" TEXT,
    "sourceReferenceId" TEXT,
    "departmentId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "condition" "warehouse"."ReturnCondition" NOT NULL DEFAULT 'GOOD',
    "postedWarehouseId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4),
    "note" TEXT,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "returns_documentNo_key" ON "warehouse"."returns"("documentNo");

-- CreateIndex
CREATE INDEX "returns_returnType_idx" ON "warehouse"."returns"("returnType");

-- CreateIndex
CREATE INDEX "returns_warehouseId_idx" ON "warehouse"."returns"("warehouseId");

-- CreateIndex
CREATE INDEX "returns_sourceReferenceType_sourceReferenceId_idx" ON "warehouse"."returns"("sourceReferenceType", "sourceReferenceId");

-- CreateIndex
CREATE INDEX "return_items_returnId_idx" ON "warehouse"."return_items"("returnId");

-- AddForeignKey
ALTER TABLE "warehouse"."returns" ADD CONSTRAINT "returns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."returns" ADD CONSTRAINT "returns_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "warehouse"."purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."return_items" ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "warehouse"."returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."return_items" ADD CONSTRAINT "return_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."return_items" ADD CONSTRAINT "return_items_postedWarehouseId_fkey" FOREIGN KEY ("postedWarehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
