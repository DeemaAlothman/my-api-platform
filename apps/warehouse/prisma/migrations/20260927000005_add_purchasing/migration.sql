-- AlterEnum: قيمة جديدة لنوع الحركة (ترحيل شراء)
ALTER TYPE "warehouse"."MovementType" ADD VALUE 'PURCHASE';

-- CreateEnum
CREATE TYPE "warehouse"."CostingMethod" AS ENUM ('HIGHEST_PRICE', 'LAST_PRICE', 'AVERAGE_PRICE');

-- CreateEnum
CREATE TYPE "warehouse"."PurchaseInvoiceStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "warehouse"."DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable: عمود جديد بقيمة افتراضية — لا يؤثر على أي صف موجود
ALTER TABLE "warehouse"."items" ADD COLUMN "costingMethod" "warehouse"."CostingMethod" NOT NULL DEFAULT 'AVERAGE_PRICE';

-- AlterTable: أعمدة تكلفة إضافية — كلها اختيارية (nullable)، فاضية لكل الأرصدة الحالية
ALTER TABLE "warehouse"."stock_balances" ADD COLUMN "lastUnitCost" DECIMAL(18,4);
ALTER TABLE "warehouse"."stock_balances" ADD COLUMN "highestUnitCost" DECIMAL(18,4);

-- CreateTable
CREATE TABLE "warehouse"."currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isBaseCurrency" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."exchange_rates" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."purchase_invoices" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,8) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discountType" "warehouse"."DiscountType",
    "discountValue" DECIMAL(18,4),
    "subtotal" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "status" "warehouse"."PurchaseInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "rejectionReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedByUserId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."purchase_invoice_items" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "baseUnitPrice" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "warehouse"."currencies"("code");

-- CreateIndex
CREATE INDEX "exchange_rates_currencyId_effectiveFrom_idx" ON "warehouse"."exchange_rates"("currencyId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_documentNo_key" ON "warehouse"."purchase_invoices"("documentNo");

-- CreateIndex
CREATE INDEX "purchase_invoices_status_idx" ON "warehouse"."purchase_invoices"("status");

-- CreateIndex
CREATE INDEX "purchase_invoices_supplierId_idx" ON "warehouse"."purchase_invoices"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_invoices_warehouseId_idx" ON "warehouse"."purchase_invoices"("warehouseId");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_purchaseInvoiceId_idx" ON "warehouse"."purchase_invoice_items"("purchaseInvoiceId");

-- AddForeignKey
ALTER TABLE "warehouse"."exchange_rates" ADD CONSTRAINT "exchange_rates_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "warehouse"."currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "warehouse"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "warehouse"."currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "warehouse"."purchase_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
