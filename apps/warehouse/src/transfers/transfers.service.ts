import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryCountsService } from '../inventory-counts/inventory-counts.service';
import { CreateTransferDto, ReceiveTransferDto } from './dto/transfer.dto';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryCounts: InventoryCountsService,
  ) {}

  private async generateDocumentNo(): Promise<string> {
    const last = await this.prisma.stockTransfer.findFirst({
      where: { documentNo: { startsWith: 'VTX-TRF-' } },
      orderBy: { documentNo: 'desc' },
      select: { documentNo: true },
    });
    const n = last ? parseInt(last.documentNo.replace('VTX-TRF-', ''), 10) : 0;
    return `VTX-TRF-${String(n + 1).padStart(6, '0')}`;
  }

  async findOne(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, fromWarehouse: true, toWarehouse: true },
    });
    if (!transfer) throw new NotFoundException({ code: 'STOCK_TRANSFER_NOT_FOUND', message: 'مستند النقل غير موجود' });
    return transfer;
  }

  async list(query: { status?: string; warehouseId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.warehouseId) where.OR = [{ fromWarehouseId: query.warehouseId }, { toWarehouseId: query.warehouseId }];

    const [items, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        include: { items: { include: { item: true } }, fromWarehouse: true, toWarehouse: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // ينفَّذ فوراً (خصم من المصدر مباشرة) بغض النظر عن حالة الأمين — الفرق فقط بالإضافة للهدف:
  // نفس الأمين للطرفين → تُنفَّذ الإضافة فوراً أيضاً (COMPLETED). أمينان مختلفان → IN_TRANSIT لحد تأكيد الاستلام.
  async create(dto: CreateTransferDto, userId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'المستودع المصدر والهدف لا يمكن أن يكونا نفس المستودع' });
    }
    const [fromWh, toWh] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: dto.fromWarehouseId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.toWarehouseId } }),
    ]);
    if (!fromWh) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع المصدر غير موجود' });
    if (!toWh) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع الهدف غير موجود' });
    if (!dto.items?.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم بند واحد على الأقل' });
    await this.inventoryCounts.assertWarehouseNotFrozen(dto.fromWarehouseId);
    await this.inventoryCounts.assertWarehouseNotFrozen(dto.toWarehouseId);

    const sameKeeper = !!fromWh.managerEmployeeId && fromWh.managerEmployeeId === toWh.managerEmployeeId;

    for (const it of dto.items) {
      const item = await this.prisma.item.findFirst({ where: { id: it.itemId, deletedAt: null } });
      if (!item) throw new BadRequestException({ code: 'ITEM_NOT_FOUND', message: `الصنف غير موجود: ${it.itemId}` });
    }

    const documentNo = await this.generateDocumentNo();
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          documentNo,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          requestedByUserId: userId,
          notes: dto.notes,
          status: sameKeeper ? 'COMPLETED' : 'IN_TRANSIT',
          sentAt: new Date(),
          ...(sameKeeper ? { receivedByUserId: userId, receivedAt: new Date() } : {}),
          items: {
            create: dto.items.map((it) => ({
              itemId: it.itemId,
              requestedQty: it.qty,
              sentQty: it.qty,
              receivedQty: sameKeeper ? it.qty : null,
            })),
          },
        },
        include: { items: true },
      });

      for (const line of transfer.items) {
        const qty = Number(line.requestedQty);

        // خروج من المصدر — يُنفَّذ فوراً بكل الحالات، بشرط توفر الكمية (شرط ذري)
        const outRows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
          `UPDATE warehouse.stock_balances
           SET "onHandQty" = "onHandQty" - $3, "updatedAt" = NOW()
           WHERE "warehouseId" = $1 AND "itemId" = $2 AND "onHandQty" - "reservedQty" >= $3
           RETURNING "onHandQty"`,
          dto.fromWarehouseId, line.itemId, qty,
        );
        if (outRows.length === 0) {
          throw new BadRequestException({ code: 'INSUFFICIENT_STOCK', message: 'الكمية المتاحة بالمستودع المصدر غير كافية' });
        }
        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            warehouseId: dto.fromWarehouseId,
            movementType: 'TRANSFER_OUT',
            onHandDelta: -qty,
            balanceAfter: outRows[0].onHandQty,
            documentType: 'TRANSFER',
            documentId: transfer.id,
            performedByUserId: userId,
          },
        });

        if (sameKeeper) {
          await tx.$executeRawUnsafe(
            `INSERT INTO warehouse.stock_balances ("warehouseId", "itemId", "onHandQty", "reservedQty", "updatedAt")
             VALUES ($1, $2, 0, 0, NOW())
             ON CONFLICT ("warehouseId", "itemId") DO NOTHING`,
            dto.toWarehouseId, line.itemId,
          );
          const inRows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
            `UPDATE warehouse.stock_balances
             SET "onHandQty" = "onHandQty" + $3, "updatedAt" = NOW()
             WHERE "warehouseId" = $1 AND "itemId" = $2
             RETURNING "onHandQty"`,
            dto.toWarehouseId, line.itemId, qty,
          );
          await tx.stockMovement.create({
            data: {
              itemId: line.itemId,
              warehouseId: dto.toWarehouseId,
              movementType: 'TRANSFER_IN',
              onHandDelta: qty,
              balanceAfter: inRows[0].onHandQty,
              documentType: 'TRANSFER',
              documentId: transfer.id,
              performedByUserId: userId,
            },
          });
        }
      }

      return tx.stockTransfer.findUnique({ where: { id: transfer.id }, include: { items: { include: { item: true } } } });
    });
  }

  // تأكيد الاستلام بالمستودع الهدف — فقط للنقل بين أمينين مختلفين (IN_TRANSIT)
  async receive(id: string, dto: ReceiveTransferDto, userId: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'مستند النقل ليس بانتظار الاستلام' });
    }
    await this.inventoryCounts.assertWarehouseNotFrozen(transfer.toWarehouseId);

    const overrideMap = new Map((dto.items ?? []).map((i) => [i.itemId, i.receivedQty]));

    return this.prisma.$transaction(async (tx) => {
      for (const line of transfer.items) {
        const sentQty = Number(line.sentQty ?? 0);
        const receivedQty = overrideMap.has(line.itemId) ? overrideMap.get(line.itemId)! : sentQty;

        await tx.$executeRawUnsafe(
          `INSERT INTO warehouse.stock_balances ("warehouseId", "itemId", "onHandQty", "reservedQty", "updatedAt")
           VALUES ($1, $2, 0, 0, NOW())
           ON CONFLICT ("warehouseId", "itemId") DO NOTHING`,
          transfer.toWarehouseId, line.itemId,
        );
        const rows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
          `UPDATE warehouse.stock_balances
           SET "onHandQty" = "onHandQty" + $3, "updatedAt" = NOW()
           WHERE "warehouseId" = $1 AND "itemId" = $2
           RETURNING "onHandQty"`,
          transfer.toWarehouseId, line.itemId, receivedQty,
        );

        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            warehouseId: transfer.toWarehouseId,
            movementType: 'TRANSFER_IN',
            onHandDelta: receivedQty,
            balanceAfter: rows[0].onHandQty,
            documentType: 'TRANSFER',
            documentId: transfer.id,
            performedByUserId: userId,
          },
        });

        await tx.stockTransferItem.update({ where: { id: line.id }, data: { receivedQty } });
      }

      return tx.stockTransfer.update({
        where: { id },
        data: { status: 'COMPLETED', receivedByUserId: userId, receivedAt: new Date() },
        include: { items: { include: { item: true } } },
      });
    });
  }
}
