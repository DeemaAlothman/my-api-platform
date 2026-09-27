-- CreateEnum
CREATE TYPE "warehouse"."MovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT');

-- CreateTable
CREATE TABLE "warehouse"."stock_balances" (
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "onHandQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reservedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "avgUnitCost" DECIMAL(18,4),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("warehouseId","itemId")
);

-- CreateTable
CREATE TABLE "warehouse"."stock_movements" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "movementType" "warehouse"."MovementType" NOT NULL,
    "onHandDelta" DECIMAL(18,3) NOT NULL,
    "balanceAfter" DECIMAL(18,3) NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT,
    "notes" TEXT,
    "performedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_itemId_warehouseId_createdAt_idx" ON "warehouse"."stock_movements"("itemId", "warehouseId", "createdAt");

-- AddForeignKey
ALTER TABLE "warehouse"."stock_balances" ADD CONSTRAINT "stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."stock_balances" ADD CONSTRAINT "stock_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: لا رصيد سالب ولا محجوز أكبر من الموجود — خط دفاع أخير على مستوى القاعدة
ALTER TABLE "warehouse"."stock_balances" ADD CONSTRAINT "stock_balances_qty_check"
  CHECK ("onHandQty" >= 0 AND "reservedQty" >= 0 AND "reservedQty" <= "onHandQty");
