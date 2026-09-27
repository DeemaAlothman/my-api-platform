import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryCountsService } from '../inventory-counts/inventory-counts.service';
import { CreateReturnDto, ReturnTypeEnum, ReturnConditionEnum } from './dto/return.dto';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryCounts: InventoryCountsService,
  ) {}

  private async generateDocumentNo(): Promise<string> {
    const last = await this.prisma.return.findFirst({
      where: { documentNo: { startsWith: 'VTX-RTN-' } },
      orderBy: { documentNo: 'desc' },
      select: { documentNo: true },
    });
    const n = last ? parseInt(last.documentNo.replace('VTX-RTN-', ''), 10) : 0;
    return `VTX-RTN-${String(n + 1).padStart(6, '0')}`;
  }

  async findOne(id: string) {
    const ret = await this.prisma.return.findUnique({
      where: { id },
      include: { items: { include: { item: true, postedWarehouse: true } }, warehouse: true, purchaseInvoice: true },
    });
    if (!ret) throw new NotFoundException({ code: 'RETURN_NOT_FOUND', message: 'المرتجع غير موجود' });
    return ret;
  }

  async list(query: { returnType?: string; warehouseId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.returnType) where.returnType = query.returnType;
    if (query.warehouseId) where.warehouseId = query.warehouseId;

    const [items, total] = await Promise.all([
      this.prisma.return.findMany({
        where,
        include: { items: { include: { item: true, postedWarehouse: true } }, warehouse: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.return.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  private async resolveDamagedWarehouseId(tx: any, explicitId?: string): Promise<string> {
    if (explicitId) {
      const wh = await tx.warehouse.findUnique({ where: { id: explicitId } });
      if (!wh) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'مستودع التالف/الحجر المحدَّد غير موجود' });
      return wh.id;
    }
    const wh = await tx.warehouse.findFirst({ where: { isActive: true, type: 'QUARANTINE' }, orderBy: { createdAt: 'asc' } });
    if (!wh) throw new BadRequestException({ code: 'NO_DAMAGED_WAREHOUSE_CONFIGURED', message: 'لا يوجد مستودع تالف/حجر مُعرَّف (نوع QUARANTINE) — أنشئي واحداً أولاً' });
    return wh.id;
  }

  async create(dto: CreateReturnDto, userId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع غير موجود' });
    if (!dto.items?.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم بند واحد على الأقل' });
    await this.inventoryCounts.assertWarehouseNotFrozen(dto.warehouseId);

    const documentNo = await this.generateDocumentNo();

    return this.prisma.$transaction(async (tx) => {
      if (dto.returnType === ReturnTypeEnum.PURCHASE_RETURN) {
        if (!dto.purchaseInvoiceId) {
          throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'مرتجع الشراء يحتاج purchaseInvoiceId' });
        }
        const invoice = await tx.purchaseInvoice.findUnique({ where: { id: dto.purchaseInvoiceId }, include: { items: true } });
        if (!invoice) throw new NotFoundException({ code: 'PURCHASE_INVOICE_NOT_FOUND', message: 'فاتورة الشراء غير موجودة' });
        if (invoice.status !== 'POSTED') {
          throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكن إرجاع فاتورة لم تُرحَّل بعد' });
        }
        if (invoice.warehouseId !== dto.warehouseId) {
          throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'المستودع لا يطابق مستودع فاتورة الشراء الأصلية' });
        }

        const returnedSoFar = await tx.returnItem.groupBy({
          by: ['itemId'],
          where: { return: { purchaseInvoiceId: dto.purchaseInvoiceId, returnType: 'PURCHASE_RETURN' } },
          _sum: { qty: true },
        });
        const returnedMap = new Map(returnedSoFar.map((r) => [r.itemId, Number(r._sum.qty ?? 0)]));

        const ret = await tx.return.create({
          data: {
            documentNo,
            returnType: 'PURCHASE_RETURN',
            warehouseId: dto.warehouseId,
            purchaseInvoiceId: dto.purchaseInvoiceId,
            createdByUserId: userId,
            notes: dto.notes,
          },
        });

        for (const it of dto.items) {
          const invoiceItem = invoice.items.find((ii) => ii.itemId === it.itemId);
          if (!invoiceItem) throw new BadRequestException({ code: 'ITEM_NOT_IN_INVOICE', message: `الصنف غير موجود بهذه الفاتورة: ${it.itemId}` });
          const originalQty = Number(invoiceItem.qty);
          const alreadyReturned = returnedMap.get(it.itemId) ?? 0;
          if (it.qty > originalQty - alreadyReturned) {
            throw new BadRequestException({ code: 'EXCEEDS_PURCHASED_QTY', message: `الكمية المرتجعة أكبر من المتبقي القابل للإرجاع لهذا الصنف` });
          }

          const rows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
            `UPDATE warehouse.stock_balances
             SET "onHandQty" = "onHandQty" - $3, "updatedAt" = NOW()
             WHERE "warehouseId" = $1 AND "itemId" = $2 AND "onHandQty" - "reservedQty" >= $3
             RETURNING "onHandQty"`,
            dto.warehouseId, it.itemId, it.qty,
          );
          if (rows.length === 0) throw new BadRequestException({ code: 'INSUFFICIENT_STOCK', message: 'الكمية المتاحة غير كافية لإرجاعها للمورّد' });

          await tx.stockMovement.create({
            data: {
              itemId: it.itemId,
              warehouseId: dto.warehouseId,
              movementType: 'RETURN_OUT',
              onHandDelta: -it.qty,
              balanceAfter: rows[0].onHandQty,
              documentType: 'RETURN',
              documentId: ret.id,
              performedByUserId: userId,
            },
          });

          await tx.returnItem.create({
            data: {
              returnId: ret.id,
              itemId: it.itemId,
              qty: it.qty,
              postedWarehouseId: dto.warehouseId,
              unitPrice: it.unitPrice ?? invoiceItem.unitPrice,
              note: it.note,
            },
          });
        }

        return tx.return.findUnique({ where: { id: ret.id }, include: { items: { include: { item: true } } } });
      }

      // ── مرتجع وارد (مبيعات / صرف داخلي / تصنيع) ──────────────────────────
      const ret = await tx.return.create({
        data: {
          documentNo,
          returnType: dto.returnType as any,
          warehouseId: dto.warehouseId,
          sourceReferenceType: dto.sourceReferenceType,
          sourceReferenceId: dto.sourceReferenceId,
          departmentId: dto.departmentId,
          createdByUserId: userId,
          notes: dto.notes,
        },
      });

      for (const it of dto.items) {
        const item = await tx.item.findFirst({ where: { id: it.itemId, deletedAt: null } });
        if (!item) throw new BadRequestException({ code: 'ITEM_NOT_FOUND', message: `الصنف غير موجود: ${it.itemId}` });

        const condition = it.condition ?? ReturnConditionEnum.GOOD;
        const postedWarehouseId = condition === ReturnConditionEnum.GOOD
          ? dto.warehouseId
          : await this.resolveDamagedWarehouseId(tx, dto.damagedWarehouseId);
        if (postedWarehouseId !== dto.warehouseId) {
          await this.inventoryCounts.assertWarehouseNotFrozen(postedWarehouseId);
        }

        await tx.$executeRawUnsafe(
          `INSERT INTO warehouse.stock_balances ("warehouseId", "itemId", "onHandQty", "reservedQty", "updatedAt")
           VALUES ($1, $2, 0, 0, NOW())
           ON CONFLICT ("warehouseId", "itemId") DO NOTHING`,
          postedWarehouseId, it.itemId,
        );
        const rows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
          `UPDATE warehouse.stock_balances
           SET "onHandQty" = "onHandQty" + $3, "updatedAt" = NOW()
           WHERE "warehouseId" = $1 AND "itemId" = $2
           RETURNING "onHandQty"`,
          postedWarehouseId, it.itemId, it.qty,
        );

        await tx.stockMovement.create({
          data: {
            itemId: it.itemId,
            warehouseId: postedWarehouseId,
            movementType: 'RETURN_IN',
            onHandDelta: it.qty,
            balanceAfter: rows[0].onHandQty,
            documentType: 'RETURN',
            documentId: ret.id,
            referenceType: dto.sourceReferenceType,
            referenceId: dto.sourceReferenceId,
            performedByUserId: userId,
          },
        });

        await tx.returnItem.create({
          data: {
            returnId: ret.id,
            itemId: it.itemId,
            qty: it.qty,
            condition: condition as any,
            postedWarehouseId,
            note: it.note,
          },
        });
      }

      return tx.return.findUnique({ where: { id: ret.id }, include: { items: { include: { item: true, postedWarehouse: true } } } });
    });
  }
}
