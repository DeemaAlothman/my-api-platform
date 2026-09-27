import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { InventoryCountsService } from '../inventory-counts/inventory-counts.service';
import { CreatePurchaseInvoiceDto, RejectPurchaseInvoiceDto } from './dto/purchase-invoice.dto';

const PRICE_FIELDS = ['unitPrice', 'baseUnitPrice', 'lineTotal'];
const INVOICE_PRICE_FIELDS = ['subtotal', 'total', 'discountType', 'discountValue', 'exchangeRate'];

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencies: CurrenciesService,
    private readonly inventoryCounts: InventoryCountsService,
  ) {}

  // يُستدعى من الـcontroller فقط لمن لا يملك warehouse.purchase_prices.view
  stripPrices(invoice: any) {
    const clone = { ...invoice };
    for (const f of INVOICE_PRICE_FIELDS) delete clone[f];
    if (Array.isArray(clone.items)) {
      clone.items = clone.items.map((it: any) => {
        const item = { ...it };
        for (const f of PRICE_FIELDS) delete item[f];
        return item;
      });
    }
    return clone;
  }

  private async generateDocumentNo(): Promise<string> {
    const last = await this.prisma.purchaseInvoice.findFirst({
      where: { documentNo: { startsWith: 'VTX-PI-' } },
      orderBy: { documentNo: 'desc' },
      select: { documentNo: true },
    });
    const n = last ? parseInt(last.documentNo.replace('VTX-PI-', ''), 10) : 0;
    return `VTX-PI-${String(n + 1).padStart(6, '0')}`;
  }

  async findOne(id: string) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
    });
    if (!invoice) throw new NotFoundException({ code: 'PURCHASE_INVOICE_NOT_FOUND', message: 'فاتورة الشراء غير موجودة' });
    return invoice;
  }

  async list(query: { status?: string; supplierId?: string; warehouseId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;

    const [items, total] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({
        where,
        include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseInvoice.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // 1) إنشاء فاتورة شراء DRAFT — يجمّد سعر الصرف الحالي لحظة الإنشاء
  async create(dto: CreatePurchaseInvoiceDto, userId: string) {
    const [supplier, warehouse] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } }),
    ]);
    if (!supplier) throw new NotFoundException({ code: 'SUPPLIER_NOT_FOUND', message: 'المورّد غير موجود' });
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع غير موجود' });
    if (!dto.items?.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم بند واحد على الأقل' });

    const exchangeRate = await this.currencies.getCurrentRate(dto.currencyId);

    let subtotal = 0;
    const itemsData = [];
    for (const it of dto.items) {
      const item = await this.prisma.item.findFirst({ where: { id: it.itemId, deletedAt: null } });
      if (!item) throw new BadRequestException({ code: 'ITEM_NOT_FOUND', message: `الصنف غير موجود: ${it.itemId}` });
      const lineTotal = it.qty * it.unitPrice;
      subtotal += lineTotal;
      itemsData.push({
        itemId: it.itemId,
        qty: it.qty,
        unitPrice: it.unitPrice,
        baseUnitPrice: it.unitPrice * exchangeRate,
        lineTotal,
      });
    }

    let total = subtotal;
    if (dto.discountType === 'PERCENT' && dto.discountValue) total = subtotal - (subtotal * dto.discountValue) / 100;
    else if (dto.discountType === 'FIXED' && dto.discountValue) total = subtotal - dto.discountValue;
    if (total < 0) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'قيمة الخصم أكبر من إجمالي الفاتورة' });

    for (let attempt = 0; attempt < 5; attempt++) {
      const documentNo = await this.generateDocumentNo();
      try {
        return await this.prisma.purchaseInvoice.create({
          data: {
            documentNo,
            supplierId: dto.supplierId,
            warehouseId: dto.warehouseId,
            currencyId: dto.currencyId,
            exchangeRate,
            invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
            discountType: dto.discountType as any,
            discountValue: dto.discountValue,
            subtotal,
            total,
            createdByUserId: userId,
            items: { create: itemsData },
          },
          include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('documentNo')) continue;
        throw err;
      }
    }
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'فشل توليد رقم الفاتورة' });
  }

  // 2) اعتماد مالي فقط — لا يمس المخزون إطلاقاً (مرحلة منفصلة عن الترحيل)
  async approve(id: string, performedByUserId: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الفاتورة ليست بانتظار الاعتماد' });
    }
    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: { status: 'APPROVED', approvedByUserId: performedByUserId, approvedAt: new Date() },
      include: { items: { include: { item: true } } },
    });
  }

  async reject(id: string, dto: RejectPurchaseInvoiceDto) {
    const invoice = await this.findOne(id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكن رفض فاتورة تم اعتمادها أو ترحيلها' });
    }
    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: dto.reason },
    });
  }

  // 3) الترحيل — يزيد الرصيد فعلياً ويحدّث تكلفة الوحدة (متوسط مرجّح دائماً يُحدَّث،
  // costingMethod على الصنف يحدد فقط أي رقم يُعرَض لاحقاً بالتقارير)
  async post(id: string, performedByUserId: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== 'APPROVED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الفاتورة يجب اعتمادها مالياً أولاً قبل الترحيل' });
    }
    await this.inventoryCounts.assertWarehouseNotFrozen(invoice.warehouseId);

    return this.prisma.$transaction(async (tx) => {
      for (const line of invoice.items) {
        const qty = Number(line.qty);
        const baseUnitPrice = Number(line.baseUnitPrice);

        await tx.$executeRawUnsafe(
          `INSERT INTO warehouse.stock_balances ("warehouseId", "itemId", "onHandQty", "reservedQty", "updatedAt")
           VALUES ($1, $2, 0, 0, NOW())
           ON CONFLICT ("warehouseId", "itemId") DO NOTHING`,
          invoice.warehouseId, line.itemId,
        );

        const rows = await tx.$queryRawUnsafe<Array<{ onHandQty: string; avgUnitCost: string | null; highestUnitCost: string | null }>>(
          `SELECT "onHandQty", "avgUnitCost", "highestUnitCost" FROM warehouse.stock_balances
           WHERE "warehouseId" = $1 AND "itemId" = $2 FOR UPDATE`,
          invoice.warehouseId, line.itemId,
        );
        const oldOnHand = parseFloat(rows[0].onHandQty);
        const oldAvg = rows[0].avgUnitCost ? parseFloat(rows[0].avgUnitCost) : 0;
        const oldHighest = rows[0].highestUnitCost ? parseFloat(rows[0].highestUnitCost) : 0;

        const newOnHand = oldOnHand + qty;
        const newAvg = newOnHand > 0 ? (oldOnHand * oldAvg + qty * baseUnitPrice) / newOnHand : baseUnitPrice;
        const newHighest = Math.max(oldHighest, baseUnitPrice);

        const updated = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
          `UPDATE warehouse.stock_balances
           SET "onHandQty" = $3, "avgUnitCost" = $4, "lastUnitCost" = $5, "highestUnitCost" = $6, "updatedAt" = NOW()
           WHERE "warehouseId" = $1 AND "itemId" = $2
           RETURNING "onHandQty"`,
          invoice.warehouseId, line.itemId, newOnHand, newAvg, baseUnitPrice, newHighest,
        );

        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            warehouseId: invoice.warehouseId,
            movementType: 'PURCHASE',
            onHandDelta: qty,
            reservedDelta: 0,
            balanceAfter: updated[0].onHandQty,
            documentType: 'PURCHASE',
            documentId: invoice.id,
            performedByUserId,
          },
        });
      }

      return tx.purchaseInvoice.update({
        where: { id },
        data: { status: 'POSTED', postedByUserId: performedByUserId, postedAt: new Date() },
        include: { items: { include: { item: true } } },
      });
    });
  }
}
