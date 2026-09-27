import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartInventoryCountDto, RecordCountsDto } from './dto/inventory-count.dto';

@Injectable()
export class InventoryCountsService {
  constructor(private readonly prisma: PrismaService) {}

  // يستدعيها أي منطق تاني بالخدمة (أرصدة، شراء، طلب مواد، نقل، مرتجعات) قبل أي عملية تكتب على المخزون
  async assertWarehouseNotFrozen(warehouseId: string): Promise<void> {
    const active = await this.prisma.inventoryCount.findFirst({
      where: { warehouseId, status: 'IN_PROGRESS' },
      select: { id: true, documentNo: true },
    });
    if (active) {
      throw new BadRequestException({
        code: 'WAREHOUSE_FROZEN_FOR_COUNT',
        message: `المستودع مجمَّد مؤقتاً بسبب جلسة جرد جارية (${active.documentNo}) — أكملي أو ألغي الجرد أولاً`,
      });
    }
  }

  private async generateDocumentNo(): Promise<string> {
    const last = await this.prisma.inventoryCount.findFirst({
      where: { documentNo: { startsWith: 'VTX-CNT-' } },
      orderBy: { documentNo: 'desc' },
      select: { documentNo: true },
    });
    const n = last ? parseInt(last.documentNo.replace('VTX-CNT-', ''), 10) : 0;
    return `VTX-CNT-${String(n + 1).padStart(6, '0')}`;
  }

  async findOne(id: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, warehouse: true },
    });
    if (!count) throw new NotFoundException({ code: 'INVENTORY_COUNT_NOT_FOUND', message: 'جلسة الجرد غير موجودة' });
    return count;
  }

  async list(query: { warehouseId?: string; status?: string }) {
    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    return this.prisma.inventoryCount.findMany({
      where,
      include: { warehouse: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  // بدء جلسة جرد — يجمّد المستودع فوراً (يمنعه القيد الفريد بقاعدة البيانات لو حاول اثنين بنفس اللحظة)
  // ويأخذ لقطة من كل الأرصدة الحالية كـ"الكمية النظامية"
  async start(dto: StartInventoryCountDto, userId: string) {
    await this.assertWarehouseNotFrozen(dto.warehouseId);
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع غير موجود' });

    const balances = await this.prisma.stockBalance.findMany({ where: { warehouseId: dto.warehouseId } });
    const documentNo = await this.generateDocumentNo();

    try {
      return await this.prisma.inventoryCount.create({
        data: {
          documentNo,
          warehouseId: dto.warehouseId,
          startedByUserId: userId,
          notes: dto.notes,
          items: { create: balances.map((b) => ({ itemId: b.itemId, systemQty: b.onHandQty })) },
        },
        include: { items: { include: { item: true } } },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException({ code: 'WAREHOUSE_FROZEN_FOR_COUNT', message: 'يوجد جلسة جرد جارية بالفعل على هذا المستودع' });
      }
      throw err;
    }
  }

  // تسجيل الكميات الفعلية المعدودة — لا يمس المخزون بعد، بس يسجّل الفروقات
  async recordCounts(id: string, dto: RecordCountsDto) {
    const count = await this.findOne(id);
    if (count.status !== 'IN_PROGRESS') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'جلسة الجرد ليست جارية' });
    }

    for (const it of dto.items) {
      const existing = count.items.find((ci) => ci.itemId === it.itemId);
      const differenceQty = existing ? it.actualQty - Number(existing.systemQty) : it.actualQty;

      if (existing) {
        await this.prisma.inventoryCountItem.update({
          where: { id: existing.id },
          data: { actualQty: it.actualQty, differenceQty, note: it.note },
        });
      } else {
        // صنف ما كان إله رصيد أصلاً بالمستودع لحظة بدء الجرد (systemQty=0) ولقاه العدّاد فعلياً
        await this.prisma.inventoryCountItem.create({
          data: { inventoryCountId: id, itemId: it.itemId, systemQty: 0, actualQty: it.actualQty, differenceQty, note: it.note },
        });
      }
    }
    return this.findOne(id);
  }

  // إنهاء الجرد — يطبّق فروقات الكميات فعلياً على المخزون (زيادة أو نقصان)، ويفكّ التجميد
  async complete(id: string, userId: string) {
    const count = await this.findOne(id);
    if (count.status !== 'IN_PROGRESS') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'جلسة الجرد ليست جارية' });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of count.items) {
        if (line.actualQty === null || line.differenceQty === null) continue;
        const diff = Number(line.differenceQty);
        if (diff === 0) continue;

        if (diff > 0) {
          await tx.$executeRawUnsafe(
            `INSERT INTO warehouse.stock_balances ("warehouseId", "itemId", "onHandQty", "reservedQty", "updatedAt")
             VALUES ($1, $2, 0, 0, NOW())
             ON CONFLICT ("warehouseId", "itemId") DO UPDATE
             SET "onHandQty" = stock_balances."onHandQty" + $3, "updatedAt" = NOW()`,
            count.warehouseId, line.itemId, diff,
          );
        } else {
          const rows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
            `UPDATE warehouse.stock_balances
             SET "onHandQty" = "onHandQty" + $3, "updatedAt" = NOW()
             WHERE "warehouseId" = $1 AND "itemId" = $2 AND "onHandQty" + $3 >= "reservedQty"
             RETURNING "onHandQty"`,
            count.warehouseId, line.itemId, diff,
          );
          if (rows.length === 0) {
            throw new BadRequestException({
              code: 'COUNT_WOULD_BREAK_RESERVATION',
              message: `تعديل الجرد على الصنف ${line.itemId} سينزل الرصيد تحت الكمية المحجوزة حالياً — راجعي الحجوزات أولاً`,
            });
          }
        }

        const balAfter = await tx.stockBalance.findUnique({ where: { warehouseId_itemId: { warehouseId: count.warehouseId, itemId: line.itemId } } });
        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            warehouseId: count.warehouseId,
            movementType: diff > 0 ? 'STOCK_IN' : 'STOCK_OUT',
            onHandDelta: diff,
            balanceAfter: balAfter!.onHandQty,
            documentType: 'INVENTORY_COUNT',
            documentId: count.id,
            notes: 'تسوية جرد',
            performedByUserId: userId,
          },
        });
      }

      return tx.inventoryCount.update({
        where: { id },
        data: { status: 'COMPLETED', completedByUserId: userId, completedAt: new Date() },
        include: { items: { include: { item: true } } },
      });
    });
  }

  // إلغاء — يفكّ التجميد فوراً بدون أي أثر على المخزون
  async cancel(id: string) {
    const count = await this.findOne(id);
    if (count.status !== 'IN_PROGRESS') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'جلسة الجرد ليست جارية' });
    }
    return this.prisma.inventoryCount.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
