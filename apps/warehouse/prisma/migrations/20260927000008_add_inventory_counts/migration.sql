-- CreateTable
CREATE TABLE "warehouse"."item_warehouse_settings" (
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "minStock" DECIMAL(18,3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_warehouse_settings_pkey" PRIMARY KEY ("itemId","warehouseId")
);

-- CreateEnum
CREATE TYPE "warehouse"."InventoryCountStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "warehouse"."inventory_counts" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "warehouse"."InventoryCountStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."inventory_count_items" (
    "id" TEXT NOT NULL,
    "inventoryCountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "systemQty" DECIMAL(18,3) NOT NULL,
    "actualQty" DECIMAL(18,3),
    "differenceQty" DECIMAL(18,3),
    "note" TEXT,

    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_counts_documentNo_key" ON "warehouse"."inventory_counts"("documentNo");

-- CreateIndex
CREATE INDEX "inventory_counts_warehouseId_idx" ON "warehouse"."inventory_counts"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_counts_status_idx" ON "warehouse"."inventory_counts"("status");

-- أهم قيد بهالخطوة: مستودع واحد ما بقدر يكون عليه أكتر من جلسة جرد IN_PROGRESS بنفس الوقت
-- (هذا هو "تجميد المستودع" فعلياً على مستوى قاعدة البيانات، مش بس بمنطق التطبيق)
CREATE UNIQUE INDEX "inventory_counts_one_active_per_warehouse"
  ON "warehouse"."inventory_counts"("warehouseId")
  WHERE "status" = 'IN_PROGRESS';

-- CreateIndex
CREATE INDEX "inventory_count_items_inventoryCountId_idx" ON "warehouse"."inventory_count_items"("inventoryCountId");

-- AddForeignKey
ALTER TABLE "warehouse"."item_warehouse_settings" ADD CONSTRAINT "item_warehouse_settings_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."item_warehouse_settings" ADD CONSTRAINT "item_warehouse_settings_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."inventory_counts" ADD CONSTRAINT "inventory_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "warehouse"."inventory_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
