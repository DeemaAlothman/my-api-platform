import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUnitDto, UpdateUnitDto,
  CreateCategoryDto, UpdateCategoryDto,
  CreateSupplierDto, UpdateSupplierDto,
  CreateItemDto, UpdateItemDto,
} from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Units ─────────────────────────────────────────────────────────────
  listUnits() {
    return this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
  }

  createUnit(dto: CreateUnitDto) {
    return this.prisma.unit.create({ data: dto });
  }

  async updateUnit(id: string, dto: UpdateUnitDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException({ code: 'UNIT_NOT_FOUND', message: 'الوحدة غير موجودة' });
    return this.prisma.unit.update({ where: { id }, data: dto });
  }

  // ── Categories ────────────────────────────────────────────────────────
  listCategories() {
    return this.prisma.itemCategory.findMany({
      where: { parentId: null },
      include: { children: true },
      orderBy: { name: 'asc' },
    });
  }

  createCategory(dto: CreateCategoryDto) {
    return this.prisma.itemCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.itemCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'الفئة غير موجودة' });
    return this.prisma.itemCategory.update({ where: { id }, data: dto });
  }

  // ── Suppliers ─────────────────────────────────────────────────────────
  listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException({ code: 'SUPPLIER_NOT_FOUND', message: 'المورّد غير موجود' });
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  // ── Items ─────────────────────────────────────────────────────────────
  async listItems(query: { search?: string; itemType?: string; categoryId?: string }) {
    const where: any = { deletedAt: null };
    if (query.itemType) where.itemType = query.itemType;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { partCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.item.findMany({
      where,
      include: { category: true, unit: true },
      orderBy: { name: 'asc' },
    });
  }

  async findItem(id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, unit: true },
    });
    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'الصنف غير موجود' });
    return item;
  }

  async createItem(dto: CreateItemDto) {
    const dupSku = await this.prisma.item.findUnique({ where: { sku: dto.sku } });
    if (dupSku) throw new BadRequestException({ code: 'DUPLICATE_SKU', message: 'يوجد صنف بنفس الـSKU مسبقاً' });
    if (dto.partCode) {
      const dupPart = await this.prisma.item.findUnique({ where: { partCode: dto.partCode } });
      if (dupPart) throw new BadRequestException({ code: 'DUPLICATE_PART_CODE', message: 'يوجد صنف بنفس رمز القطعة مسبقاً' });
    }
    return this.prisma.item.create({ data: dto as any, include: { category: true, unit: true } });
  }

  async updateItem(id: string, dto: UpdateItemDto) {
    await this.findItem(id);
    if (dto.partCode) {
      const dupPart = await this.prisma.item.findFirst({ where: { partCode: dto.partCode, id: { not: id } } });
      if (dupPart) throw new BadRequestException({ code: 'DUPLICATE_PART_CODE', message: 'يوجد صنف بنفس رمز القطعة مسبقاً' });
    }
    return this.prisma.item.update({ where: { id }, data: dto as any, include: { category: true, unit: true } });
  }

  async deleteItem(id: string) {
    await this.findItem(id);
    await this.prisma.item.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    return { deleted: true };
  }
}
