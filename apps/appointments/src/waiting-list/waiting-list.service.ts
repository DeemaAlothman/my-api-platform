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

  async findAll(query: ListWaitingListQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 50;
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.waitingListEntry.findMany({
        where, skip, take: limit,
        orderBy: [{ priority: 'desc' }, { registrationDate: 'asc' }],
      }),
      this.prisma.waitingListEntry.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // تصدير Excel — الحالة المختارة فقط، أو كل الحالات إن لم تُحدَّد. بدون صفحات.
  async exportXlsx(status: string | undefined, res: Response) {
    const where: any = {};
    if (status) where.status = status;

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
