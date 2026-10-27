import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUnitDto, UpdateUnitDto,
  CreateCategoryDto, UpdateCategoryDto,
  CreateSupplierDto, UpdateSupplierDto,
  CreateItemDto, UpdateItemDto,
  CreateManufacturerDto, UpdateManufacturerDto,
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

  // ── Manufacturers ─────────────────────────────────────────────────────
  listManufacturers() {
    return this.prisma.manufacturer.findMany({ orderBy: { name: 'asc' } });
  }

  createManufacturer(dto: CreateManufacturerDto) {
    return this.prisma.manufacturer.create({ data: dto });
  }

  async updateManufacturer(id: string, dto: UpdateManufacturerDto) {
    const manufacturer = await this.prisma.manufacturer.findUnique({ where: { id } });
    if (!manufacturer) throw new NotFoundException({ code: 'MANUFACTURER_NOT_FOUND', message: 'الشركة المصنّعة غير موجودة' });
    return this.prisma.manufacturer.update({ where: { id }, data: dto });
  }

  async deleteManufacturer(id: string) {
    const manufacturer = await this.prisma.manufacturer.findUnique({ where: { id } });
    if (!manufacturer) throw new NotFoundException({ code: 'MANUFACTURER_NOT_FOUND', message: 'الشركة المصنّعة غير موجودة' });
    const inUse = await this.prisma.item.count({ where: { manufacturerId: id, deletedAt: null } });
    if (inUse > 0) {
      throw new BadRequestException({ code: 'MANUFACTURER_IN_USE', message: 'لا يمكن حذف شركة مصنّعة مرتبطة بأصناف موجودة' });
    }
    await this.prisma.manufacturer.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Items ─────────────────────────────────────────────────────────────
  private async generateSku(): Promise<string> {
    const last = await this.prisma.item.findFirst({
      where: { sku: { startsWith: 'VTX-ITM-' } },
      orderBy: { sku: 'desc' },
      select: { sku: true },
    });
    const n = last ? parseInt(last.sku.replace('VTX-ITM-', ''), 10) : 0;
    return `VTX-ITM-${String(n + 1).padStart(6, '0')}`;
  }

  async listItems(query: { search?: string; categoryId?: string }) {
    const where: any = { deletedAt: null };
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
      include: { category: true, unit: true, manufacturer: true },
      orderBy: { name: 'asc' },
    });
  }

  async findItem(id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, unit: true, manufacturer: true },
    });
    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'الصنف غير موجود' });
    return item;
  }

  async createItem(dto: CreateItemDto) {
    if (!dto.name && !dto.nameAr) {
      throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'أدخل الاسم بالعربي أو بالإنكليزي' });
    }
    const sku = dto.sku || await this.generateSku();
    const dupSku = await this.prisma.item.findUnique({ where: { sku } });
    if (dupSku) throw new BadRequestException({ code: 'DUPLICATE_SKU', message: 'يوجد صنف بنفس الـSKU مسبقاً' });
    if (dto.partCode) {
      const dupPart = await this.prisma.item.findUnique({ where: { partCode: dto.partCode } });
      if (dupPart) throw new BadRequestException({ code: 'DUPLICATE_PART_CODE', message: 'يوجد صنف بنفس رمز القطعة مسبقاً' });
    }
    return this.prisma.item.create({ data: { ...dto, sku } as any, include: { category: true, unit: true, manufacturer: true } });
  }

  async updateItem(id: string, dto: UpdateItemDto) {
    const existing = await this.findItem(id);
    if (dto.name === null && dto.nameAr === null) {
      throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'أدخل الاسم بالعربي أو بالإنكليزي' });
    }
    const nextName = dto.name !== undefined ? dto.name : existing.name;
    const nextNameAr = dto.nameAr !== undefined ? dto.nameAr : existing.nameAr;
    if (!nextName && !nextNameAr) {
      throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'أدخل الاسم بالعربي أو بالإنكليزي' });
    }
    if (dto.partCode) {
      const dupPart = await this.prisma.item.findFirst({ where: { partCode: dto.partCode, id: { not: id } } });
      if (dupPart) throw new BadRequestException({ code: 'DUPLICATE_PART_CODE', message: 'يوجد صنف بنفس رمز القطعة مسبقاً' });
    }
    return this.prisma.item.update({ where: { id }, data: dto as any, include: { category: true, unit: true, manufacturer: true } });
  }

  async deleteItem(id: string) {
    await this.findItem(id);
    await this.prisma.item.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    return { deleted: true };
  }
}
