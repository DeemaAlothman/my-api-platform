import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
        patientName:     dto.patientName,
        gender:          dto.gender as any,
        age:             dto.age,
        arrivalMethod:   dto.arrivalMethod as any,
        serviceType:     dto.serviceType,
        appointmentType: dto.appointmentType as any,
        contactNumber:   dto.contactNumber,
        priority:        dto.priority,
        notes:           dto.notes,
        createdBy:       userId,
      },
    });
  }

  // فلاتر مشتركة للقائمة والتصدير
  private buildWhere(status?: string, search?: string, appointmentType?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (appointmentType) where.appointmentType = appointmentType;
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
    const where = this.buildWhere(query.status, query.search, query.appointmentType);

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
        patientName:     dto.patientName,
        gender:          dto.gender as any,
        age:             dto.age,
        arrivalMethod:   dto.arrivalMethod as any,
        serviceType:     dto.serviceType,
        appointmentType: dto.appointmentType as any,
        contactNumber:   dto.contactNumber,
        priority:        dto.priority,
        notes:           dto.notes,
        status:          dto.status as any,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.waitingListEntry.delete({ where: { id } });
    return { message: 'تم حذف السجل من قائمة الانتظار' };
  }

  // توحيد الاسم قبل المقارنة: حذف الفراغات الزائدة، وتوحيد الحروف المتشابهة شكلاً
  private normalizeName(name: string | null | undefined): string {
    return (name ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .toLowerCase();
  }

  private async getPractitionerNames(userIds: string[]): Promise<Record<string, string>> {
    if (userIds.length === 0) return {};
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string; firstNameAr: string; lastNameAr: string }>>(
      `SELECT "userId", "firstNameAr", "lastNameAr" FROM users.employees WHERE "userId" = ANY($1::text[]) AND "deletedAt" IS NULL`,
      userIds,
    ).catch(() => [] as Array<{ userId: string; firstNameAr: string; lastNameAr: string }>);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.userId] = `${r.firstNameAr} ${r.lastNameAr}`.trim();
    return map;
  }

  // المواعيد القادمة غير الملغية وغير المربوطة أصلاً بسجل تاني، يلي ممكن تكون نفس الشخص
  // (مريض مسجّل: رقم تواصل أو اسم كامل مطابق — غير مسجّل: الاسم بس)
  async findAppointmentMatches(id: string) {
    const entry = await this.findOne(id);

    const candidates = await this.prisma.$queryRawUnsafe<Array<{
      id: string; patientId: string | null; patientName: string | null; contactNumber: string | null;
      startTime: Date; appointmentType: string; practitionerId: string;
      patientFirstName: string | null; patientLastName: string | null;
      patientPhone: string | null; patientWhatsapp: string | null;
    }>>(
      `SELECT a.id, a."patientId", a."patientName", a."contactNumber", a."startTime", a."appointmentType", a."practitionerId",
              p."firstName" AS "patientFirstName", p."lastName" AS "patientLastName",
              p."phone" AS "patientPhone", p."whatsapp" AS "patientWhatsapp"
       FROM clinic_appointments.appointments a
       LEFT JOIN clinic_patients.patients p ON p.id = a."patientId" AND p."deletedAt" IS NULL
       WHERE a.status != 'CANCELLED'
         AND a."startTime" >= NOW()
         AND NOT EXISTS (
           SELECT 1 FROM clinic_appointments.waiting_list_entries w2 WHERE w2."appointmentId" = a.id
         )
       ORDER BY a."startTime" ASC`,
    );

    const targetName = this.normalizeName(entry.patientName);
    const targetContact = entry.contactNumber?.trim() || null;

    const matches = candidates.filter((c) => {
      if (c.patientId) {
        const fullName = this.normalizeName(`${c.patientFirstName ?? ''} ${c.patientLastName ?? ''}`);
        const phoneMatch = !!targetContact && (
          c.patientPhone?.trim() === targetContact || c.patientWhatsapp?.trim() === targetContact
        );
        return phoneMatch || (fullName.length > 0 && fullName === targetName);
      }
      return this.normalizeName(c.patientName) === targetName;
    });

    const practitionerIds = [...new Set(matches.map((m) => m.practitionerId))];
    const practitionerMap = await this.getPractitionerNames(practitionerIds);

    return matches
      .map((m) => ({
        id: m.id,
        patientName: m.patientId ? `${m.patientFirstName ?? ''} ${m.patientLastName ?? ''}`.trim() : m.patientName,
        date: m.startTime.toISOString().slice(0, 10),
        startTime: m.startTime,
        appointmentType: m.appointmentType,
        practitioner: practitionerMap[m.practitionerId] ?? null,
        sameType: !!entry.appointmentType && m.appointmentType === entry.appointmentType,
      }))
      .sort((a, b) => {
        if (a.sameType !== b.sameType) return a.sameType ? -1 : 1;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
  }

  // يربط موعداً موجوداً بسجل قائمة الانتظار ويحوّله لـSCHEDULED بعملية واحدة — ما في ربط تلقائي أبداً،
  // هاي الدالة هي المسار الوحيد (إضافة لـwaitingListEntryId عند إنشاء موعد جديد)
  async linkAppointment(id: string, appointmentId: string) {
    await this.findOne(id);

    const apptRows = await this.prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `SELECT id, status FROM clinic_appointments.appointments WHERE id = $1`,
      appointmentId,
    );
    const appt = apptRows[0];
    if (!appt) throw new NotFoundException('الموعد غير موجود');
    if (appt.status === 'CANCELLED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكن الربط بموعد ملغى' });
    }

    const existingLink = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM clinic_appointments.waiting_list_entries WHERE "appointmentId" = $1`,
      appointmentId,
    );
    if (existingLink.length > 0 && existingLink[0].id !== id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'هذا الموعد مربوط بسجل قائمة انتظار آخر مسبقاً' });
    }

    return this.prisma.waitingListEntry.update({
      where: { id },
      data: { appointmentId, status: 'SCHEDULED' as any },
    });
  }
}
