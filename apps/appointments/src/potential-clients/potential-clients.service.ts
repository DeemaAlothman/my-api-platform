import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePotentialClientDto, UpdatePotentialClientDto, ListPotentialClientsQueryDto,
  ExportPotentialClientsQueryDto,
} from './dto/potential-client.dto';
import { sendExcel } from '../common/utils/excel.util';

const GENDER_AR: Record<string, string> = { MALE: 'ذكر', FEMALE: 'أنثى' };
const ARRIVAL_AR: Record<string, string> = {
  SOCIAL_MEDIA: 'وسائل التواصل', HOSPITAL: 'مستشفى', DOCTOR: 'طبيب',
  ASSOCIATION: 'جمعية', FRIEND: 'صديق', STAFF: 'موظف',
};

@Injectable()
export class PotentialClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePotentialClientDto, userId: string) {
    return this.prisma.potentialClient.create({
      data: {
        patientName:       dto.patientName,
        gender:            dto.gender as any,
        age:               dto.age,
        arrivalMethod:     dto.arrivalMethod as any,
        interestedService: dto.interestedService,
        contactNumber:     dto.contactNumber,
        notes:             dto.notes,
        createdBy:         userId,
      },
    });
  }

  // فلاتر مشتركة للقائمة والتصدير
  private buildWhere(query: ExportPotentialClientsQueryDto) {
    const where: any = {};
    if (query.interestedService) where.interestedService = query.interestedService;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { patientName:       { contains: search, mode: 'insensitive' } },
        { contactNumber:     { contains: search, mode: 'insensitive' } },
        { interestedService: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async findAll(query: ListPotentialClientsQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 50;
    const skip  = (page - 1) * limit;
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.potentialClient.findMany({
        where, skip, take: limit,
        orderBy: { registrationDate: 'asc' },
      }),
      this.prisma.potentialClient.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // الخدمات المميّزة الموجودة بالسجلات — للقائمة المنسدلة
  async findServices() {
    const rows = await this.prisma.potentialClient.findMany({
      distinct: ['interestedService'],
      select: { interestedService: true },
      orderBy: { interestedService: 'asc' },
    });
    return rows.map((r) => r.interestedService);
  }

  // تصدير Excel — كل السجلات المطابقة للفلاتر، بدون صفحات
  async exportXlsx(query: ExportPotentialClientsQueryDto, res: Response) {
    const items = await this.prisma.potentialClient.findMany({
      where: this.buildWhere(query),
      orderBy: { registrationDate: 'asc' },
    });
    const rows = items.map((e) => [
      e.patientName,
      GENDER_AR[e.gender] ?? e.gender,
      e.age ?? '',
      e.registrationDate ? e.registrationDate.toISOString().slice(0, 10) : '',
      e.arrivalMethod ? (ARRIVAL_AR[e.arrivalMethod] ?? e.arrivalMethod) : '',
      e.interestedService ?? '',
      e.contactNumber ?? '',
      e.notes ?? '',
    ]);
    await sendExcel(
      res,
      'العملاء المحتملين',
      ['اسم المريض', 'الجنس', 'العمر', 'تاريخ التسجيل', 'طريقة الوصول', 'خدمة مهتم بها', 'رقم التواصل', 'الملاحظات'],
      rows,
    );
  }

  async findOne(id: string) {
    const entry = await this.prisma.potentialClient.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('لم يتم العثور على العميل المحتمل');
    return entry;
  }

  async update(id: string, dto: UpdatePotentialClientDto) {
    await this.findOne(id);
    return this.prisma.potentialClient.update({
      where: { id },
      data: {
        patientName:       dto.patientName,
        gender:            dto.gender as any,
        age:               dto.age,
        arrivalMethod:     dto.arrivalMethod as any,
        interestedService: dto.interestedService,
        contactNumber:     dto.contactNumber,
        notes:             dto.notes,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.potentialClient.delete({ where: { id } });
    return { message: 'تم حذف العميل المحتمل' };
  }
}
