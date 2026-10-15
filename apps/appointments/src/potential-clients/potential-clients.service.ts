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
    return this.prisma.potentialClient.create({
      data: {
        patientName:       dto.patientName,
        gender:            dto.gender as any,
        age:               dto.age,
        arrivalMethod:     dto.arrivalMethod as any,
        interestedService: dto.interestedService,
        contactNumber:     dto.contactNumber,
        residence:         dto.residence,
        notes:             dto.notes,
        visitedCenter:     dto.visitedCenter ?? null,
        paidVisit:         dto.paidVisit ?? null,
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
      e.residence ?? '',
      YES_NO_AR(e.visitedCenter),
      YES_NO_AR(e.paidVisit),
      e.notes ?? '',
    ]);
    await sendExcel(
      res,
      'العملاء المحتملين',
      ['اسم المريض', 'الجنس', 'العمر', 'تاريخ التسجيل', 'طريقة الوصول', 'خدمة مهتم بها', 'رقم التواصل', 'مكان الإقامة', 'زار المركز', 'استفاد بدفع فعلي', 'الملاحظات'],
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
        residence:         dto.residence,
        notes:             dto.notes,
        visitedCenter:     dto.visitedCenter,
        paidVisit:         dto.paidVisit,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.potentialClient.delete({ where: { id } });
    return { message: 'تم حذف العميل المحتمل' };
  }

  // ── Attachments ──────────────────────────────────────────────────────

  async addAttachment(potentialClientId: string, file: Express.Multer.File, userId: string) {
    if (!file) throw new BadRequestException('لم يتم رفع أي ملف');
    await this.findOne(potentialClientId);

    return this.prisma.potentialClientAttachment.create({
      data: {
        potentialClientId,
        fileUrl: (file as any).path, // المسار الفعلي على القرص من diskStorage
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
      },
    });
  }

  async getAttachments(potentialClientId: string) {
    await this.findOne(potentialClientId);
    return this.prisma.potentialClientAttachment.findMany({
      where: { potentialClientId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getAttachmentForDownload(potentialClientId: string, attachmentId: string) {
    const att = await this.prisma.potentialClientAttachment.findFirst({
      where: { id: attachmentId, potentialClientId },
    });
    if (!att) throw new NotFoundException('المرفق غير موجود');
    return att;
  }

  async deleteAttachment(potentialClientId: string, attachmentId: string) {
    const att = await this.prisma.potentialClientAttachment.findFirst({
      where: { id: attachmentId, potentialClientId },
    });
    if (!att) throw new NotFoundException('المرفق غير موجود');
    await this.prisma.potentialClientAttachment.delete({ where: { id: attachmentId } });
    return { message: 'تم حذف المرفق' };
  }
}
