import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryCountsService } from '../inventory-counts/inventory-counts.service';
import { AdjustStockDto, StockDirection } from './dto/stock.dto';

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryCounts: InventoryCountsService,
  ) {}

  private async assertWarehouseAndItemExist(warehouseId: string, itemId: string) {
    const [warehouse, item] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: warehouseId } }),
      this.prisma.item.findFirst({ where: { id: itemId, deletedAt: null } }),
    ]);
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع غير موجود' });
    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'الصنف غير موجود' });
  }

  // تعديل يدوي للرصيد (إدخال/إخراج) — عملية ذرية بالكامل داخل معاملة واحدة،
  // بشرط SQL يمنع صراحة أي رصيد سالب حتى تحت تزامن عالٍ (lost update)
  async adjust(dto: AdjustStockDto, performedByUserId: string) {
    await this.assertWarehouseAndItemExist(dto.warehouseId, dto.itemId);
    await this.inventoryCounts.assertWarehouseNotFrozen(dto.warehouseId);

    return this.prisma.$transaction(async (tx) => {
      let rows: Array<{ onHandQty: string }>;

      if (dto.direction === StockDirection.IN) {
        rows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
          `INSERT INTO warehouse.stock_balances ("warehouseId", "itemId", "onHandQty", "reservedQty", "updatedAt")
           VALUES ($1, $2, $3, 0, NOW())
           ON CONFLICT ("warehouseId", "itemId") DO UPDATE
           SET "onHandQty" = stock_balances."onHandQty" + $3, "updatedAt" = NOW()
           RETURNING "onHandQty"`,
          dto.warehouseId, dto.itemId, dto.quantity,
        );
      } else {
        rows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
          `UPDATE warehouse.stock_balances
           SET "onHandQty" = "onHandQty" - $3, "updatedAt" = NOW()
           WHERE "warehouseId" = $1 AND "itemId" = $2
             AND "onHandQty" - "reservedQty" >= $3
           RETURNING "onHandQty"`,
          dto.warehouseId, dto.itemId, dto.quantity,
        );
        if (rows.length === 0) {
          throw new BadRequestException({ code: 'INSUFFICIENT_STOCK', message: 'الكمية المتاحة غير كافية لإتمام الإخراج' });
        }
      }

      const balanceAfter = rows[0].onHandQty;
      const movement = await tx.stockMovement.create({
        data: {
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          movementType: dto.direction === StockDirection.IN ? 'STOCK_IN' : 'STOCK_OUT',
          onHandDelta: dto.direction === StockDirection.IN ? dto.quantity : -dto.quantity,
          balanceAfter,
          documentType: 'MANUAL',
          notes: dto.notes,
          performedByUserId,
        },
      });

      return { balanceAfter, movement };
    });
  }

  async listBalances(query: { warehouseId?: string; itemId?: string }) {
    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.itemId) where.itemId = query.itemId;
    const balances = await this.prisma.stockBalance.findMany({
      where,
      include: { warehouse: true, item: { include: { unit: true } } },
    });
    return balances.map((b) => ({
      ...b,
      availableQty: Number(b.onHandQty) - Number(b.reservedQty),
    }));
  }

  async listMovements(query: { warehouseId?: string; itemId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.itemId) where.itemId = query.itemId;

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: { item: true, warehouse: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // حد أدنى لصنف داخل مستودع محدد — يتجاوز items.minStock العام عند وجوده (قرار: لكل مادة داخل كل مستودع لحاله)
  async setMinStock(warehouseId: string, itemId: string, minStock: number) {
    await this.assertWarehouseAndItemExist(warehouseId, itemId);
    return this.prisma.itemWarehouseSetting.upsert({
      where: { itemId_warehouseId: { itemId, warehouseId } },
      create: { itemId, warehouseId, minStock },
      update: { minStock },
    });
  }

  // المواد تحت الحد الأدنى — حسب حد المستودع الخاص إن وُجد، وإلا الحد العام على الصنف
  async lowStock(warehouseId?: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      warehouseId: string; itemId: string; onHandQty: string; reservedQty: string;
      name: string; nameAr: string | null; sku: string; effectiveMinStock: string;
    }>>(
      `SELECT b."warehouseId", b."itemId", b."onHandQty", b."reservedQty",
              i.name, i."nameAr", i.sku,
              COALESCE(s."minStock", i."minStock") AS "effectiveMinStock"
       FROM warehouse.stock_balances b
       JOIN warehouse.items i ON i.id = b."itemId"
       LEFT JOIN warehouse.item_warehouse_settings s ON s."itemId" = b."itemId" AND s."warehouseId" = b."warehouseId"
       WHERE COALESCE(s."minStock", i."minStock") IS NOT NULL
         AND b."onHandQty" <= COALESCE(s."minStock", i."minStock")
         ${warehouseId ? 'AND b."warehouseId" = $1' : ''}
       ORDER BY (b."onHandQty" / NULLIF(COALESCE(s."minStock", i."minStock"), 0)) ASC`,
      ...(warehouseId ? [warehouseId] : []),
    );
    return rows;
  }
}
