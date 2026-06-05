import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients.query.dto';
import { CreateConsentDto } from './dto/create-consent.dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  private async generatePatientNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const last = await this.prisma.patient.findFirst({
      where: { patientNumber: { startsWith: `P-${year}-` } },
      orderBy: { patientNumber: 'desc' },
    });
    const seq = last
      ? parseInt(last.patientNumber.split('-')[2], 10) + 1
      : 1;
    return `P-${year}-${String(seq).padStart(4, '0')}`;
  }

  async create(dto: CreatePatientDto, userId: string) {
    const existing = await this.prisma.patient.findFirst({
      where: { idNumber: dto.idNumber, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('مريض بهذا رقم الهوية موجود مسبقاً');
    }

    const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
    if (!city) throw new BadRequestException('المدينة غير موجودة');

    const patientNumber = await this.generatePatientNumber();
    const bmi = dto.heightCm && dto.weightKg
      ? Math.round((dto.weightKg / Math.pow(dto.heightCm / 100, 2)) * 10) / 10
      : null;

    return this.prisma.patient.create({
      data: {
        ...dto,
        patientNumber,
        bmi,
        dateOfBirth: new Date(dto.dateOfBirth),
        createdBy: userId,
      },
      include: { city: true },
    });
  }

  async findAll(query: ListPatientsQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { patientNumber: { contains: query.search, mode: 'insensitive' } },
        { idNumber: { contains: query.search } },
      ];
    }
    if (query.cityId) where.cityId = query.cityId;
    if (query.gender) where.gender = query.gender;
    if (query.governorate) where.city = { governorate: query.governorate };

    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        include: { city: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, deletedAt: null },
      include: {
        city: true,
        documents: { orderBy: { uploadedAt: 'desc' } },
        consents: { orderBy: { createdAt: 'desc' } },
        notes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!patient) throw new NotFoundException('المريض غير موجود');
    return patient;
  }

  async update(id: string, dto: Partial<CreatePatientDto>) {
    const patient = await this.prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundException('المريض غير موجود');

    if (dto.idNumber && dto.idNumber !== patient.idNumber) {
      const dup = await this.prisma.patient.findFirst({
        where: { idNumber: dto.idNumber, deletedAt: null, id: { not: id } },
      });
      if (dup) throw new ConflictException('رقم الهوية مستخدم من مريض آخر');
    }

    const bmi = (dto.heightCm || patient.heightCm) && (dto.weightKg || patient.weightKg)
      ? Math.round(((dto.weightKg || patient.weightKg)! / Math.pow(((dto.heightCm || patient.heightCm)! / 100), 2)) * 10) / 10
      : patient.bmi;

    return this.prisma.patient.update({
      where: { id },
      data: {
        ...dto,
        bmi,
        ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      },
      include: { city: true },
    });
  }

  async remove(id: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundException('المريض غير موجود');
    await this.prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'تم حذف المريض بنجاح' };
  }

  async existsInternal(id: string): Promise<{ exists: boolean }> {
    const patient = await this.prisma.patient.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return { exists: !!patient };
  }

  async checkDuplicate(idNumber: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { idNumber, deletedAt: null },
      select: { id: true, patientNumber: true, firstName: true, lastName: true },
    });
    return { exists: !!patient, patient: patient || null };
  }

  // ── Documents ─────────────────────────────────────────────────────

  async addDocument(patientId: string, file: Express.Multer.File, type: string, userId: string) {
    if (!file) throw new BadRequestException('لم يتم رفع أي ملف');
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw new NotFoundException('المريض غير موجود');

    return this.prisma.patientDocument.create({
      data: {
        patientId,
        type: type as any,
        fileName: file.originalname,
        filePath: (file as any).path, // المسار الفعلي على القرص من diskStorage
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
      },
    });
  }

  async getDocumentForDownload(patientId: string, docId: string) {
    const doc = await this.prisma.patientDocument.findFirst({
      where: { id: docId, patientId },
    });
    if (!doc) throw new NotFoundException('الوثيقة غير موجودة');
    return doc;
  }

  async getDocuments(patientId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw new NotFoundException('المريض غير موجود');
    return this.prisma.patientDocument.findMany({
      where: { patientId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async deleteDocument(patientId: string, docId: string) {
    const doc = await this.prisma.patientDocument.findFirst({ where: { id: docId, patientId } });
    if (!doc) throw new NotFoundException('الوثيقة غير موجودة');
    await this.prisma.patientDocument.delete({ where: { id: docId } });
    return { message: 'تم حذف الوثيقة' };
  }

  // ── Consents ──────────────────────────────────────────────────────

  async addConsent(patientId: string, dto: CreateConsentDto, userId: string, ip: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw new NotFoundException('المريض غير موجود');

    return this.prisma.consent.create({
      data: {
        patientId,
        type: dto.type as any,
        decision: dto.decision as any,
        signedByPatient: dto.signedByPatient,
        signatureBase64: dto.signatureBase64,
        witnessUserId: dto.witnessUserId || userId,
        ipAddress: ip,
        signedAt: new Date(),
      },
    });
  }

  async getConsents(patientId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw new NotFoundException('المريض غير موجود');
    return this.prisma.consent.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Notes ─────────────────────────────────────────────────────────

  async addNote(patientId: string, body: string, userId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw new NotFoundException('المريض غير موجود');
    return this.prisma.patientNote.create({ data: { patientId, body, authorId: userId } });
  }

  async getNotes(patientId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw new NotFoundException('المريض غير موجود');
    return this.prisma.patientNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
