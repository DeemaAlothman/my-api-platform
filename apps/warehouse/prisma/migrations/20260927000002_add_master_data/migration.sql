-- CreateEnum
CREATE TYPE "warehouse"."WarehouseType" AS ENUM ('MAIN', 'QUARANTINE', 'OTHER');

-- CreateEnum
CREATE TYPE "warehouse"."ItemType" AS ENUM ('COMPONENT', 'CONSUMABLE', 'SERVICE');

-- CreateTable
CREATE TABLE "warehouse"."warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "warehouse"."WarehouseType" NOT NULL DEFAULT 'MAIN',
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "managerEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."item_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."items" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "partCode" TEXT,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "itemType" "warehouse"."ItemType" NOT NULL DEFAULT 'CONSUMABLE',
    "categoryId" TEXT,
    "unitId" TEXT NOT NULL,
    "manufacturer" TEXT,
    "minStock" DECIMAL(18,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouse"."warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "items_sku_key" ON "warehouse"."items"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "items_partCode_key" ON "warehouse"."items"("partCode");

-- CreateIndex
CREATE INDEX "items_categoryId_idx" ON "warehouse"."items"("categoryId");

-- CreateIndex
CREATE INDEX "items_unitId_idx" ON "warehouse"."items"("unitId");

-- AddForeignKey
ALTER TABLE "warehouse"."item_categories" ADD CONSTRAINT "item_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "warehouse"."item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."items" ADD CONSTRAINT "items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "warehouse"."item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."items" ADD CONSTRAINT "items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "warehouse"."units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
