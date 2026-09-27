-- AlterEnum: قيمتان جديدتان لنوع الحركة (نقل صادر/وارد)
ALTER TYPE "warehouse"."MovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "warehouse"."MovementType" ADD VALUE 'TRANSFER_IN';

-- CreateEnum
CREATE TYPE "warehouse"."StockTransferStatus" AS ENUM ('IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "warehouse"."stock_transfers" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" "warehouse"."StockTransferStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "requestedByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."stock_transfer_items" (
    "id" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "requestedQty" DECIMAL(18,3) NOT NULL,
    "sentQty" DECIMAL(18,3),
    "receivedQty" DECIMAL(18,3),

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_documentNo_key" ON "warehouse"."stock_transfers"("documentNo");

-- CreateIndex
CREATE INDEX "stock_transfers_status_idx" ON "warehouse"."stock_transfers"("status");

-- CreateIndex
CREATE INDEX "stock_transfers_fromWarehouseId_idx" ON "warehouse"."stock_transfers"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "stock_transfers_toWarehouseId_idx" ON "warehouse"."stock_transfers"("toWarehouseId");

-- CreateIndex
CREATE INDEX "stock_transfer_items_stockTransferId_idx" ON "warehouse"."stock_transfer_items"("stockTransferId");

-- AddForeignKey
ALTER TABLE "warehouse"."stock_transfers" ADD CONSTRAINT "stock_transfers_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."stock_transfers" ADD CONSTRAINT "stock_transfers_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "warehouse"."stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
