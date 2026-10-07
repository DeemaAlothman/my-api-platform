import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
const YES_NO_AR = (v: boolean | null) => (v === true ? 'نعم' : v === false ? 'لا' : '');

@Injectable()
export class PotentialClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePotentialClientDto, userId: string) {
    const visitedCenter = dto.visitedCenter ?? null;
    return this.prisma.potentialClient.create({
      data: {
        patientName:       dto.patientName,
        gender:            dto.gender as any,
        age:               dto.age,
        arrivalMethod:     dto.arrivalMethod as any,
        interestedService: dto.interestedService,
        contactNumber:     dto.contactNumber,
        notes:             dto.notes,
        visitedCenter,
        // الدفع له معنى فقط إذا زار المركز
        paidVisit:         visitedCenter === true ? (dto.paidVisit ?? null) : null,
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
    // حدود اليوم بتوقيت سوريا (UTC+3): من بداية dateFrom، وحتى ما قبل بداية اليوم التالي لـ dateTo
    if (query.dateFrom || query.dateTo) {
      where.registrationDate = {};
      if (query.dateFrom) where.registrationDate.gte = new Date(`${query.dateFrom}T00:00:00+03:00`);
      if (query.dateTo) {
        const end = new Date(`${query.dateTo}T00:00:00+03:00`);
        end.setUTCDate(end.getUTCDate() + 1);
        where.registrationDate.lt = end;
      }
      for (const d of Object.values(where.registrationDate) as Date[]) {
        if (isNaN(d.getTime())) throw new BadRequestException('تاريخ غير صالح');
      }
    }
    if (query.visitedCenter) where.visitedCenter = query.visitedCenter === 'true';
    if (query.paidVisit)     where.paidVisit     = query.paidVisit === 'true';
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
      YES_NO_AR(e.visitedCenter),
      YES_NO_AR(e.paidVisit),
      e.notes ?? '',
    ]);
    await sendExcel(
      res,
      'العملاء المحتملين',
      ['اسم المريض', 'الجنس', 'العمر', 'تاريخ التسجيل', 'طريقة الوصول', 'خدمة مهتم بها', 'رقم التواصل', 'زار المركز', 'استفاد بدفع فعلي', 'الملاحظات'],
      rows,
    );
  }

  async findOne(id: string) {
    const entry = await this.prisma.potentialClient.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('لم يتم العثور على العميل المحتمل');
    return entry;
  }

  async update(id: string, dto: UpdatePotentialClientDto) {
    const existing = await this.findOne(id);

    // الدفع له معنى فقط إذا زار المركز — إن لم يكن "زار" (لا / غير محدد) يُفرَّغ الدفع
    const visitData: { visitedCenter?: boolean | null; paidVisit?: boolean | null } = {};
    if (dto.visitedCenter !== undefined || dto.paidVisit !== undefined) {
      const visited = dto.visitedCenter !== undefined ? dto.visitedCenter : existing.visitedCenter;
      if (dto.visitedCenter !== undefined) visitData.visitedCenter = dto.visitedCenter;
      if (visited !== true) visitData.paidVisit = null;
      else if (dto.paidVisit !== undefined) visitData.paidVisit = dto.paidVisit;
    }

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
        ...visitData,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.potentialClient.delete({ where: { id } });
    return { message: 'تم حذف العميل المحتمل' };
  }
}
