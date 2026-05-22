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

  async createItem(dto: CreateItemDto) {
    return this.prisma.inventoryItem.create({
      data: dto,
      include: { category: true, supplier: true },
    });
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
    await this.findItem(id);
    return this.prisma.inventoryItem.update({
      where: { id },
      data,
      include: { category: true, supplier: true },
    });
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
