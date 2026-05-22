-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "clinic_inventory";

-- CreateEnum
CREATE TYPE "clinic_inventory"."InventoryType" AS ENUM ('COMPONENT', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "clinic_inventory"."TransactionType" AS ENUM ('RECEIVED', 'ISSUED', 'ADJUSTED', 'RETURNED', 'EXPIRED');

-- CreateTable
CREATE TABLE "clinic_inventory"."inventory_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "parentId" INTEGER,
    "type" "clinic_inventory"."InventoryType" NOT NULL,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_inventory"."suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactInfo" JSONB,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_inventory"."inventory_items" (
    "id" TEXT NOT NULL,
    "partCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "supplierId" TEXT,
    "unit" TEXT NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStockLevel" DOUBLE PRECISION,
    "unitCostUsd" DOUBLE PRECISION,
    "type" "clinic_inventory"."InventoryType" NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_inventory"."inventory_transactions" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "clinic_inventory"."TransactionType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "receivedFromSupplier" TEXT,
    "poNumber" TEXT,
    "issuedToCaseId" TEXT,
    "issuedToPatientId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_partCode_key" ON "clinic_inventory"."inventory_items"("partCode");
CREATE INDEX "inventory_items_currentStock_idx" ON "clinic_inventory"."inventory_items"("currentStock");
CREATE INDEX "inventory_transactions_itemId_idx" ON "clinic_inventory"."inventory_transactions"("itemId");
CREATE INDEX "inventory_transactions_createdAt_idx" ON "clinic_inventory"."inventory_transactions"("createdAt");

-- AddForeignKey
ALTER TABLE "clinic_inventory"."inventory_categories" ADD CONSTRAINT "inventory_categories_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "clinic_inventory"."inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clinic_inventory"."inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "clinic_inventory"."inventory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clinic_inventory"."inventory_items" ADD CONSTRAINT "inventory_items_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "clinic_inventory"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clinic_inventory"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "clinic_inventory"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
