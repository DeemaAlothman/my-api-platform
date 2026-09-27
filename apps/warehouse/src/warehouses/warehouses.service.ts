import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع غير موجود' });
    return warehouse;
  }

  async create(dto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException({ code: 'DUPLICATE_CODE', message: 'يوجد مستودع بنفس الكود مسبقاً' });
    return this.prisma.warehouse.create({ data: dto as any });
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.findOne(id);
    return this.prisma.warehouse.update({ where: { id }, data: dto as any });
  }
}
