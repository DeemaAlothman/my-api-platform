import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWaitingListEntryDto, UpdateWaitingListEntryDto, ListWaitingListQueryDto,
} from './dto/waiting-list.dto';
import { sendExcel } from '../common/utils/excel.util';

const GENDER_AR: Record<string, string> = { MALE: 'ذكر', FEMALE: 'أنثى' };
const STATUS_AR: Record<string, string> = { WAITING: 'قيد الانتظار', SCHEDULED: 'تمت الجدولة', NOT_SCHEDULED: 'لم تتم الجدولة' };
const ARRIVAL_AR: Record<string, string> = {
  SOCIAL_MEDIA: 'وسائل التواصل', HOSPITAL: 'مستشفى', DOCTOR: 'طبيب',
  ASSOCIATION: 'جمعية', FRIEND: 'صديق', STAFF: 'موظف',
};

@Injectable()
export class WaitingListService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWaitingListEntryDto, userId: string) {
    return this.prisma.waitingListEntry.create({
      data: {
        patientName:    dto.patientName,
        gender:         dto.gender as any,
        age:            dto.age,
        arrivalMethod:  dto.arrivalMethod as any,
        serviceType:    dto.serviceType,
        contactNumber:  dto.contactNumber,
        priority:       dto.priority,
        notes:          dto.notes,
        createdBy:      userId,
      },
    });
  }

  // فلاتر مشتركة للقائمة والتصدير
  private buildWhere(status?: string, search?: string) {
    const where: any = {};
    if (status) where.status = status;
    const term = search?.trim();
    if (term) {
      where.OR = [
        { patientName:  { contains: term, mode: 'insensitive' } },
        { contactNumber: { contains: term, mode: 'insensitive' } },
        { serviceType:  { contains: term, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async findAll(query: ListWaitingListQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 50;
    const skip  = (page - 1) * limit;
    const where = this.buildWhere(query.status, query.search);

    const [items, total] = await Promise.all([
      this.prisma.waitingListEntry.findMany({
        where, skip, take: limit,
        orderBy: [{ priority: 'desc' }, { registrationDate: 'asc' }],
      }),
      this.prisma.waitingListEntry.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // تصدير Excel — بنفس فلاتر القائمة (حالة + بحث)، بدون صفحات.
  async exportXlsx(status: string | undefined, res: Response, search?: string) {
    const where = this.buildWhere(status, search);

    const items = await this.prisma.waitingListEntry.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { registrationDate: 'asc' }],
    });

    const rows = items.map((e) => [
      e.patientName,
      GENDER_AR[e.gender] ?? e.gender,
      e.age ?? '',
      e.registrationDate ? e.registrationDate.toISOString().slice(0, 10) : '',
      e.arrivalMethod ? (ARRIVAL_AR[e.arrivalMethod] ?? e.arrivalMethod) : '',
      e.serviceType ?? '',
      e.contactNumber ?? '',
      e.priority,
      e.notes ?? '',
      STATUS_AR[e.status] ?? e.status,
    ]);

    const label = status ? (STATUS_AR[status] ?? status) : 'جميع الحالات';
    await sendExcel(
      res,
      `قائمة الانتظار - ${label}`,
      ['اسم المريض', 'الجنس', 'العمر', 'تاريخ التسجيل', 'طريقة الوصول', 'نوع الخدمة', 'رقم التواصل', 'الأولوية', 'الملاحظات', 'الحالة'],
      rows,
    );
  }

  async findOne(id: string) {
    const entry = await this.prisma.waitingListEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('لم يتم العثور على السجل بقائمة الانتظار');
    return entry;
  }

  async update(id: string, dto: UpdateWaitingListEntryDto) {
    await this.findOne(id);
    return this.prisma.waitingListEntry.update({
      where: { id },
      data: {
        patientName:   dto.patientName,
        gender:        dto.gender as any,
        age:           dto.age,
        arrivalMethod: dto.arrivalMethod as any,
        serviceType:   dto.serviceType,
        contactNumber: dto.contactNumber,
        priority:      dto.priority,
        notes:         dto.notes,
        status:        dto.status as any,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.waitingListEntry.delete({ where: { id } });
    return { message: 'تم حذف السجل من قائمة الانتظار' };
  }
}
