-- CreateEnum
CREATE TYPE "warehouse"."QuotationStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "warehouse"."QuotationLineType" AS ENUM ('ITEM', 'SERVICE', 'SESSION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "warehouse"."SalesInvoiceStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "warehouse"."quotations" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentQuotationId" TEXT,
    "patientId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,8) NOT NULL,
    "discountType" "warehouse"."DiscountType",
    "discountValue" DECIMAL(18,4),
    "subtotal" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "paymentTerms" TEXT,
    "status" "warehouse"."QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedByName" TEXT,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "lineType" "warehouse"."QuotationLineType" NOT NULL DEFAULT 'ITEM',
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountType" "warehouse"."DiscountType",
    "discountValue" DECIMAL(18,4),
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."sales_invoices" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "quotationId" TEXT,
    "patientId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,8) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discountType" "warehouse"."DiscountType",
    "discountValue" DECIMAL(18,4),
    "subtotal" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "paymentMethod" TEXT,
    "paymentTerms" TEXT,
    "status" "warehouse"."SalesInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."sales_invoice_items" (
    "id" TEXT NOT NULL,
    "salesInvoiceId" TEXT NOT NULL,
    "lineType" "warehouse"."QuotationLineType" NOT NULL DEFAULT 'ITEM',
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountType" "warehouse"."DiscountType",
    "discountValue" DECIMAL(18,4),
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "sales_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_documentNo_key" ON "warehouse"."quotations"("documentNo");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "warehouse"."quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_patientId_idx" ON "warehouse"."quotations"("patientId");

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "warehouse"."quotation_items"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_documentNo_key" ON "warehouse"."sales_invoices"("documentNo");

-- CreateIndex
CREATE INDEX "sales_invoices_status_idx" ON "warehouse"."sales_invoices"("status");

-- CreateIndex
CREATE INDEX "sales_invoices_patientId_idx" ON "warehouse"."sales_invoices"("patientId");

-- CreateIndex
CREATE INDEX "sales_invoice_items_salesInvoiceId_idx" ON "warehouse"."sales_invoice_items"("salesInvoiceId");

-- AddForeignKey
ALTER TABLE "warehouse"."quotations" ADD CONSTRAINT "quotations_parentQuotationId_fkey" FOREIGN KEY ("parentQuotationId") REFERENCES "warehouse"."quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."quotations" ADD CONSTRAINT "quotations_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "warehouse"."currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "warehouse"."quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."quotation_items" ADD CONSTRAINT "quotation_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."sales_invoices" ADD CONSTRAINT "sales_invoices_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "warehouse"."quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."sales_invoices" ADD CONSTRAINT "sales_invoices_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "warehouse"."currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "warehouse"."sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
