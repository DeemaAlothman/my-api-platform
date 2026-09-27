import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryCountsService } from '../inventory-counts/inventory-counts.service';
import {
  CreateMaterialRequestDto, ApproveMaterialRequestDto, RejectMaterialRequestDto, IssueMaterialRequestDto,
  CreateFromPartCodeDto,
} from './dto/material-request.dto';

@Injectable()
export class MaterialRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryCounts: InventoryCountsService,
  ) {}

  private async generateDocumentNo(): Promise<string> {
    const last = await this.prisma.materialRequest.findFirst({
      where: { documentNo: { startsWith: 'VTX-MRQ-' } },
      orderBy: { documentNo: 'desc' },
      select: { documentNo: true },
    });
    const n = last ? parseInt(last.documentNo.replace('VTX-MRQ-', ''), 10) : 0;
    return `VTX-MRQ-${String(n + 1).padStart(6, '0')}`;
  }

  async findOne(id: string) {
    const request = await this.prisma.materialRequest.findUnique({
      where: { id },
      include: { items: { include: { item: { include: { unit: true } } } }, warehouse: true },
    });
    if (!request) throw new NotFoundException({ code: 'MATERIAL_REQUEST_NOT_FOUND', message: 'طلب المواد غير موجود' });
    return request;
  }

  async list(query: { status?: string; warehouseId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.warehouseId) where.warehouseId = query.warehouseId;

    const [items, total] = await Promise.all([
      this.prisma.materialRequest.findMany({
        where,
        include: { items: { include: { item: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.materialRequest.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async listMine(userId: string) {
    return this.prisma.materialRequest.findMany({
      where: { requestedByUserId: userId },
      include: { items: { include: { item: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 1) تقديم طلب مواد → SUBMITTED (بدون أي حجز بعد)
  async create(dto: CreateMaterialRequestDto, userId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع غير موجود' });
    if (!dto.items?.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم بند واحد على الأقل' });

    for (const it of dto.items) {
      const item = await this.prisma.item.findFirst({ where: { id: it.itemId, deletedAt: null } });
      if (!item) throw new BadRequestException({ code: 'ITEM_NOT_FOUND', message: `الصنف غير موجود: ${it.itemId}` });
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const documentNo = await this.generateDocumentNo();
      try {
        const request = await this.prisma.materialRequest.create({
          data: {
            documentNo,
            warehouseId: dto.warehouseId,
            referenceType: dto.referenceType ?? 'MANUAL',
            referenceId: dto.referenceId,
            departmentId: dto.departmentId,
            requestedByUserId: userId,
            notes: dto.notes,
            items: { create: dto.items.map((it) => ({ itemId: it.itemId, requestedQty: it.requestedQty })) },
          },
          include: { items: { include: { item: true } } },
        });
        return request;
      } catch (err: any) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('documentNo')) continue;
        throw err;
      }
    }
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'فشل توليد رقم الطلب' });
  }

  // 2) اعتماد المسؤول اللوجستي/المستودع → يحجز فوراً بقدر المتاح (كامل أو جزئي)
  async approve(id: string, dto: ApproveMaterialRequestDto, performedByUserId: string) {
    const request = await this.findOne(id);
    if (request.status !== 'SUBMITTED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الطلب ليس بانتظار الاعتماد' });
    }
    await this.inventoryCounts.assertWarehouseNotFrozen(request.warehouseId);

    const overrideMap = new Map((dto.items ?? []).map((i) => [i.itemId, i.approvedQty]));

    return this.prisma.$transaction(async (tx) => {
      let allFull = true;
      let anyApproved = false;

      for (const line of request.items) {
        const requestedQty = Number(line.requestedQty);
        const desiredQty = overrideMap.has(line.itemId) ? Math.min(overrideMap.get(line.itemId)!, requestedQty) : requestedQty;
        if (desiredQty <= 0) { allFull = false; continue; }

        // قفل صف الرصيد لمنع أي تعارض تزامن أثناء حساب "المتاح"
        const balRows = await tx.$queryRawUnsafe<Array<{ onHandQty: string; reservedQty: string }>>(
          `SELECT "onHandQty", "reservedQty" FROM warehouse.stock_balances
           WHERE "warehouseId" = $1 AND "itemId" = $2 FOR UPDATE`,
          request.warehouseId, line.itemId,
        );
        const onHand = balRows.length ? parseFloat(balRows[0].onHandQty) : 0;
        const reserved = balRows.length ? parseFloat(balRows[0].reservedQty) : 0;
        const available = Math.max(0, onHand - reserved);
        const grantQty = Math.min(desiredQty, available);

        if (grantQty <= 0) { allFull = false; continue; }
        if (grantQty < requestedQty) allFull = false;
        anyApproved = true;

        const updated = await tx.$queryRawUnsafe<Array<{ onHandQty: string; reservedQty: string }>>(
          `UPDATE warehouse.stock_balances
           SET "reservedQty" = "reservedQty" + $3, "updatedAt" = NOW()
           WHERE "warehouseId" = $1 AND "itemId" = $2
           RETURNING "onHandQty", "reservedQty"`,
          request.warehouseId, line.itemId, grantQty,
        );

        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            warehouseId: request.warehouseId,
            movementType: 'RESERVE',
            onHandDelta: 0,
            reservedDelta: grantQty,
            balanceAfter: updated[0].onHandQty,
            documentType: 'MATERIAL_REQUEST',
            documentId: request.id,
            referenceType: request.referenceType,
            referenceId: request.referenceId,
            performedByUserId,
          },
        });

        await tx.materialRequestItem.update({ where: { id: line.id }, data: { approvedQty: grantQty } });
      }

      const status = !anyApproved ? 'PARTIALLY_APPROVED' : allFull ? 'APPROVED' : 'PARTIALLY_APPROVED';
      await tx.materialRequest.update({ where: { id }, data: { status } });
      return tx.materialRequest.findUnique({ where: { id }, include: { items: { include: { item: true } } } });
    });
  }

  // رفض — فقط قبل أي اعتماد/حجز (بدون حاجة لتحرير حجز لأنو ما صار حجز بعد)
  async reject(id: string, dto: RejectMaterialRequestDto) {
    const request = await this.findOne(id);
    if (request.status !== 'SUBMITTED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكن رفض طلب تم اعتماده جزئياً أو كلياً' });
    }
    return this.prisma.materialRequest.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: dto.reason },
    });
  }

  // 3) الصرف الفعلي — ينقل الكمية من "محجوز" إلى "مصروف" فعلياً (يخصم On Hand)
  async issue(id: string, dto: IssueMaterialRequestDto, performedByUserId: string) {
    const request = await this.findOne(id);
    if (!['APPROVED', 'PARTIALLY_APPROVED', 'PARTIALLY_ISSUED'].includes(request.status)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الطلب ليس بحالة يمكن الصرف منها' });
    }
    await this.inventoryCounts.assertWarehouseNotFrozen(request.warehouseId);

    const overrideMap = new Map((dto.items ?? []).map((i) => [i.itemId, i.issuedQty]));

    return this.prisma.$transaction(async (tx) => {
      let allIssued = true;
      let anyIssued = false;

      for (const line of request.items) {
        const approvedQty = Number(line.approvedQty);
        const alreadyIssued = Number(line.issuedQty);
        const remaining = approvedQty - alreadyIssued;
        if (remaining <= 0) continue;

        const requestedNow = overrideMap.has(line.itemId) ? Math.min(overrideMap.get(line.itemId)!, remaining) : remaining;
        if (requestedNow <= 0) { allIssued = false; continue; }

        const updated = await tx.$queryRawUnsafe<Array<{ onHandQty: string; reservedQty: string }>>(
          `UPDATE warehouse.stock_balances
           SET "onHandQty" = "onHandQty" - $3, "reservedQty" = "reservedQty" - $3, "updatedAt" = NOW()
           WHERE "warehouseId" = $1 AND "itemId" = $2 AND "reservedQty" >= $3
           RETURNING "onHandQty", "reservedQty"`,
          request.warehouseId, line.itemId, requestedNow,
        );
        if (updated.length === 0) {
          // لا يفترض حدوثه إطلاقاً (الكمية محجوزة أصلاً بخطوة الاعتماد) — نتوقف بدل ما نكمل بحالة غير متسقة
          throw new BadRequestException({ code: 'RESERVATION_MISMATCH', message: 'تعارض غير متوقع بين المحجوز والمصروف — لم يتم صرف أي شيء' });
        }

        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            warehouseId: request.warehouseId,
            movementType: 'ISSUE',
            onHandDelta: -requestedNow,
            reservedDelta: -requestedNow,
            balanceAfter: updated[0].onHandQty,
            documentType: 'MATERIAL_REQUEST',
            documentId: request.id,
            referenceType: request.referenceType,
            referenceId: request.referenceId,
            performedByUserId,
          },
        });

        const newIssuedQty = alreadyIssued + requestedNow;
        await tx.materialRequestItem.update({ where: { id: line.id }, data: { issuedQty: newIssuedQty } });
        anyIssued = true;
        if (newIssuedQty < approvedQty) allIssued = false;
      }

      const status = allIssued && anyIssued ? 'ISSUED' : anyIssued ? 'PARTIALLY_ISSUED' : request.status;
      await tx.materialRequest.update({ where: { id }, data: { status } });
      return tx.materialRequest.findUnique({ where: { id }, include: { items: { include: { item: true } } } });
    });
  }

  // ── نداءات خدمة-لخدمة (InternalAuthGuard) — لربط خدمات خارجية مثل الأطراف الصناعية ──

  // ينشئ الطلب فقط إذا كان الصنف موجوداً فعلاً بكتالوج المستودع بنفس partCode.
  // إذا لم يوجد، يرجع matched:false بدون أي خطأ — القرار بعدها للخدمة المستدعية (كما بالنظام القديم matchedInInventory)
  async createFromPartCode(dto: CreateFromPartCodeDto) {
    let warehouseId = dto.warehouseId;
    if (warehouseId) {
      const wh = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
      if (!wh) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع غير موجود' });
    } else {
      const wh = await this.prisma.warehouse.findFirst({ where: { isActive: true, type: 'MAIN' }, orderBy: { createdAt: 'asc' } });
      if (!wh) return { matched: false, reason: 'NO_WAREHOUSE_CONFIGURED' };
      warehouseId = wh.id;
    }

    const item = await this.prisma.item.findFirst({ where: { partCode: dto.partCode, isActive: true, deletedAt: null } });
    if (!item) return { matched: false, reason: 'ITEM_NOT_FOUND' };

    const request = await this.create(
      {
        warehouseId,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        notes: dto.notes,
        items: [{ itemId: item.id, requestedQty: dto.quantity }],
      },
      dto.requestedByUserId,
    );

    return { matched: true, materialRequestId: request.id, documentNo: request.documentNo, itemId: item.id, status: request.status };
  }

  async getStatusInternal(id: string) {
    const request = await this.prisma.materialRequest.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!request) throw new NotFoundException({ code: 'MATERIAL_REQUEST_NOT_FOUND', message: 'طلب المواد غير موجود' });
    return {
      id: request.id,
      documentNo: request.documentNo,
      status: request.status,
      rejectionReason: request.rejectionReason,
      items: request.items.map((i) => ({
        itemId: i.itemId,
        requestedQty: i.requestedQty,
        approvedQty: i.approvedQty,
        issuedQty: i.issuedQty,
      })),
    };
  }
}
