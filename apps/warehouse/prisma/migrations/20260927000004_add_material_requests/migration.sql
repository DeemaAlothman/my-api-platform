-- AlterEnum: إضافة قيم جديدة لنوع الحركة (الحجز والصرف)
ALTER TYPE "warehouse"."MovementType" ADD VALUE 'RESERVE';
ALTER TYPE "warehouse"."MovementType" ADD VALUE 'ISSUE';

-- AlterTable: أعمدة جديدة على سجل الحركات (كلها اختيارية/بقيمة افتراضية — بدون أي تأثير على الصفوف الموجودة)
ALTER TABLE "warehouse"."stock_movements" ALTER COLUMN "onHandDelta" SET DEFAULT 0;
ALTER TABLE "warehouse"."stock_movements" ADD COLUMN "reservedDelta" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "warehouse"."stock_movements" ADD COLUMN "referenceType" TEXT;
ALTER TABLE "warehouse"."stock_movements" ADD COLUMN "referenceId" TEXT;

-- CreateIndex
CREATE INDEX "stock_movements_documentType_documentId_idx" ON "warehouse"."stock_movements"("documentType", "documentId");

-- CreateEnum
CREATE TYPE "warehouse"."MaterialRequestStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PARTIALLY_ISSUED', 'ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "warehouse"."material_requests" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "warehouse"."MaterialRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "referenceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "referenceId" TEXT,
    "departmentId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse"."material_request_items" (
    "id" TEXT NOT NULL,
    "materialRequestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "requestedQty" DECIMAL(18,3) NOT NULL,
    "approvedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "issuedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,

    CONSTRAINT "material_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_requests_documentNo_key" ON "warehouse"."material_requests"("documentNo");

-- CreateIndex
CREATE INDEX "material_requests_status_idx" ON "warehouse"."material_requests"("status");

-- CreateIndex
CREATE INDEX "material_requests_referenceType_referenceId_idx" ON "warehouse"."material_requests"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "material_requests_requestedByUserId_idx" ON "warehouse"."material_requests"("requestedByUserId");

-- CreateIndex
CREATE INDEX "material_request_items_materialRequestId_idx" ON "warehouse"."material_request_items"("materialRequestId");

-- AddForeignKey
ALTER TABLE "warehouse"."material_requests" ADD CONSTRAINT "material_requests_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."material_request_items" ADD CONSTRAINT "material_request_items_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "warehouse"."material_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse"."material_request_items" ADD CONSTRAINT "material_request_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "warehouse"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
