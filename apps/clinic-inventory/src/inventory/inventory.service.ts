import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateTransactionDto, InternalDeductDto } from './dto/create-transaction.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.inventoryCategory.findMany({
      include: { children: true },
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(data: { name: string; nameAr: string; type: 'COMPONENT' | 'CONSUMABLE'; parentId?: number }) {
    return this.prisma.inventoryCategory.create({ data });
  }

  // ── Suppliers ─────────────────────────────────────────────────────

  async listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  async createSupplier(data: { name: string; contactInfo?: any }) {
    return this.prisma.supplier.create({ data });
  }

  // ── Items ─────────────────────────────────────────────────────────

  async listItems(query: { type?: string; categoryId?: number; search?: string; lowStock?: boolean }) {
    const where: any = { isActive: true };
    if (query.type) where.type = query.type;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { partCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.lowStock) {
      where.AND = [
        { minStockLevel: { not: null } },
        { currentStock: { lte: this.prisma.inventoryItem.fields.minStockLevel } },
      ];
    }

    return this.prisma.inventoryItem.findMany({
      where,
      include: { category: true, supplier: true },
      orderBy: { name: 'asc' },
    });
  }

  private readonly MANAGER_USER_IDS = [
    '415be69c-749b-41f5-a800-43b63baa794c',
    'f2297d60-1c06-44d7-b68d-cc5980affd37',
  ];

  private readonly STATUS_LABEL: Record<string, string> = {
    APPROVED:      'معتمد',
    DONE:          'تم',
    NOT_AVAILABLE: 'لا يوجد',
    PENDING:       'معلق',
  };

  async createItem(dto: CreateItemDto, requestedByUserId: string) {
    const item = await this.prisma.inventoryItem.create({
      data: { ...dto, status: 'PENDING', requestedByUserId },
      include: { category: true, supplier: true },
    });

    for (const managerId of this.MANAGER_USER_IDS) {
      try {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications
             (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
           VALUES
             (gen_random_uuid(), $1, 'INVENTORY_REQUEST',
              'طلب قطعة جديد', 'New Part Request', $2, $3, false, NOW())`,
          managerId,
          `طلب قطعة جديد بانتظار مراجعتك: ${item.name} (${item.partCode})`,
          `New part request awaiting review: ${item.name} (${item.partCode})`,
        );
      } catch (_) { /* userId غير موجود — تجاهل */ }
    }

    return item;
  }

  async findItem(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { category: true, supplier: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async findItemByCode(partCode: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { partCode },
      include: { category: true, supplier: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async updateItem(id: string, data: Partial<CreateItemDto>) {
    const existing = await this.findItem(id);
    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data,
      include: { category: true, supplier: true },
    });

    if (data.status && data.status !== existing.status && existing.requestedByUserId) {
      const label = this.STATUS_LABEL[data.status] ?? data.status;
      const notesText = data.notes ? ` — ملاحظة: ${data.notes}` : '';
      try {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications
             (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
           VALUES
             (gen_random_uuid(), $1, 'INVENTORY_REQUEST_UPDATE',
              'تحديث طلب قطعة', 'Part Request Update', $2, $3, false, NOW())`,
          existing.requestedByUserId,
          `تم تحديث حالة طلب القطعة "${existing.name}" إلى: ${label}${notesText}`,
          `Part request "${existing.name}" status updated to: ${label}`,
        );
      } catch (_) { /* userId غير موجود — تجاهل */ }
    }

    return updated;
  }

  async deleteItem(id: string) {
    await this.findItem(id);
    await this.prisma.inventoryItem.update({
      where: { id },
      data: { isActive: false },
    });
    return { deleted: true };
  }

  async importFromExcel(buffer: Buffer): Promise<{ created: number; skipped: number; errors: string[] }> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('الملف فارغ أو لا يحتوي على أوراق');

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // الصف الأول هو الرؤوس — نبدأ من الصف الثاني
    sheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
      if (rowNumber === 1) return;

      const cell = (col: number) => {
        const v = row.getCell(col).value;
        return v !== null && v !== undefined ? String(v).trim() : '';
      };

      const partCode   = cell(1);
      const name       = cell(2);
      const nameAr     = cell(3);
      const companyName = cell(4);
      const unit       = cell(5);
      const type       = cell(6).toUpperCase() as any;
      const currentStock = parseFloat(cell(7)) || 0;
      const minStockLevel = cell(8) ? parseFloat(cell(8)) : undefined;
      const unitCostUsd   = cell(9) ? parseFloat(cell(9)) : undefined;

      if (!partCode || !name || !unit) {
        errors.push(`صف ${rowNumber}: رمز الصنف، الاسم، والوحدة إلزامية`);
        return;
      }

      try {
        await this.prisma.inventoryItem.upsert({
          where: { partCode },
          create: {
            partCode, name, nameAr: nameAr || null,
            companyName: companyName || null, unit,
            type: ['COMPONENT', 'CONSUMABLE'].includes(type) ? type : undefined,
            currentStock, minStockLevel, unitCostUsd,
          },
          update: {
            name, nameAr: nameAr || null,
            companyName: companyName || null, unit,
            type: ['COMPONENT', 'CONSUMABLE'].includes(type) ? type : undefined,
            currentStock, minStockLevel, unitCostUsd,
            isActive: true,
          },
        });
        created++;
      } catch {
        skipped++;
        errors.push(`صف ${rowNumber}: فشل حفظ الصنف "${partCode}"`);
      }
    });

    return { created, skipped, errors };
  }

  // ── Transactions ──────────────────────────────────────────────────

  async addTransaction(itemId: string, dto: CreateTransactionDto, userId: string) {
    const item = await this.findItem(itemId);

    const stockDelta = dto.type === 'ISSUED' || dto.type === 'EXPIRED'
      ? -dto.quantity
      : dto.quantity;

    const newStock = item.currentStock + stockDelta;
    if (newStock < 0) throw new BadRequestException('Insufficient stock');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.inventoryTransaction.create({
        data: {
          itemId,
          type: dto.type as any,
          quantity: dto.quantity,
          receivedFromSupplier: dto.receivedFromSupplier,
          poNumber: dto.poNumber,
          issuedToCaseId: dto.issuedToCaseId,
          issuedToPatientId: dto.issuedToPatientId,
          notes: dto.notes,
          createdBy: userId,
        },
      });
      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { currentStock: newStock },
      });
      return transaction;
    });
  }

  async getItemHistory(itemId: string) {
    await this.findItem(itemId);
    return this.prisma.inventoryTransaction.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listTransactions(query: { from?: string; to?: string }) {
    const where: any = {};
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    return this.prisma.inventoryTransaction.findMany({
      where,
      include: { item: { select: { id: true, name: true, partCode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async getLowStockAlerts() {
    return this.prisma.$queryRaw`
      SELECT id, "partCode", name, "nameAr", "currentStock", "minStockLevel", unit
      FROM "clinic_inventory"."inventory_items"
      WHERE "isActive" = true
        AND "minStockLevel" IS NOT NULL
        AND "currentStock" <= "minStockLevel"
      ORDER BY ("currentStock" / NULLIF("minStockLevel", 0)) ASC
    `;
  }

  // ── Internal deduct (called by prosthetics service) ───────────────

  async internalDeduct(dto: InternalDeductDto) {
    const item = await this.findItem(dto.itemId);
    if (item.currentStock < dto.quantity) throw new BadRequestException('Insufficient stock');

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryTransaction.create({
        data: {
          itemId: dto.itemId,
          type: 'ISSUED',
          quantity: dto.quantity,
          issuedToCaseId: dto.issuedToCaseId,
          issuedToPatientId: dto.issuedToPatientId,
          notes: dto.reason,
          createdBy: dto.userId,
        },
      });
      await tx.inventoryItem.update({
        where: { id: dto.itemId },
        data: { currentStock: item.currentStock - dto.quantity },
      });
      return { success: true };
    });
  }

  async checkStock(itemId: string, qty: number) {
    const item = await this.findItem(itemId);
    return { available: item.currentStock >= qty, currentStock: item.currentStock };
  }
}
