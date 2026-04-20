import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../infrastructure/mail.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { MoveStageDto } from './dto/move-stage.dto';
import { CreateOfferDto } from './dto/create-offer.dto';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly mail: MailService,
  ) {}

  // ==================== Candidates ====================

  async create(dto: CreateCandidateDto, userId?: string) {
    return this.prisma.candidate.create({
      data: {
        firstNameAr: dto.firstNameAr,
        lastNameAr: dto.lastNameAr,
        firstNameEn: dto.firstNameEn,
        lastNameEn: dto.lastNameEn,
        email: dto.email,
        phone: dto.phone,
        nationalId: dto.nationalId,
        positionId: dto.positionId,
        source: dto.source as any,
        cvUrl: dto.cvUrl,
        expectedSalary: dto.expectedSalary,
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  async findAll(query: {
    stage?: string;
    positionId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.stage) where.currentStage = query.stage;
    if (query.positionId) where.positionId = query.positionId;

    const [items, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          position: { select: { id: true, jobTitle: true, department: true } },
          offers: { select: { id: true, status: true, basicSalary: true } },
        },
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id, deletedAt: null },
      include: {
        position: true,
        stageHistory: { orderBy: { changedAt: 'desc' } },
        offers: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!candidate) throw new NotFoundException('المتقدم غير موجود');
    return candidate;
  }

  async moveStage(id: string, dto: MoveStageDto, userId?: string) {
    const candidate = await this.prisma.candidate.findFirst({ where: { id, deletedAt: null } });
    if (!candidate) throw new NotFoundException('المتقدم غير موجود');

    const updateData: any = { currentStage: dto.stage };
    if (dto.rejectionReason) updateData.rejectionReason = dto.rejectionReason;

    const [updated] = await this.prisma.$transaction([
      this.prisma.candidate.update({ where: { id }, data: updateData }),
      this.prisma.candidateStageHistory.create({
        data: {
          candidateId: id,
          fromStage: candidate.currentStage,
          toStage: dto.stage as any,
          notes: dto.notes,
          changedBy: userId,
        },
      }),
    ]);

    // إرسال إيميل رفض تلقائي عند الانتقال لـ REJECTED
    if (dto.stage === 'REJECTED' && (candidate as any).email) {
      const position = await this.prisma.interviewPosition.findFirst({
        where: { id: (candidate as any).positionId },
        select: { jobTitle: true },
      }).catch(() => null);
      await this.mail.sendRejectionEmail(
        candidate as any,
        position?.jobTitle ?? 'الوظيفة',
      );
    }

    return updated;
  }

  async delete(id: string) {
    const candidate = await this.prisma.candidate.findFirst({ where: { id, deletedAt: null } });
    if (!candidate) throw new NotFoundException('المتقدم غير موجود');
    return this.prisma.candidate.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ==================== Offers ====================

  async createOffer(candidateId: string, dto: CreateOfferDto, userId?: string) {
    const candidate = await this.prisma.candidate.findFirst({ where: { id: candidateId, deletedAt: null } });
    if (!candidate) throw new NotFoundException('المتقدم غير موجود');

    const offer = await this.prisma.jobOffer.create({
      data: {
        candidateId,
        positionId: candidate.positionId,
        basicSalary: dto.basicSalary,
        currency: dto.currency || 'SYP',
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        benefits: dto.benefits,
        notes: dto.notes,
        createdBy: userId,
      },
    });

    // نقل المتقدم لمرحلة OFFER_SENT تلقائياً
    await this.moveStage(candidateId, { stage: 'OFFER_SENT' as any, notes: 'تم إرسال عرض عمل' }, userId);

    return offer;
  }

  async updateOfferStatus(offerId: string, status: string) {
    const offer = await this.prisma.jobOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('عرض العمل غير موجود');

    const updateData: any = { status };
    if (status === 'SENT') updateData.sentAt = new Date();
    if (['ACCEPTED', 'REJECTED'].includes(status)) updateData.respondedAt = new Date();

    return this.prisma.jobOffer.update({ where: { id: offerId }, data: updateData });
  }

  // ==================== تحويل لموظف ====================

  async convertToEmployee(candidateId: string, extra: {
    departmentId: string;
    jobTitleId?: string;
    hireDate?: string;
    contractType?: string;
    basicSalary?: number;
  }, userId?: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, deletedAt: null },
      include: { offers: { where: { status: 'ACCEPTED' }, take: 1 } },
    });
    if (!candidate) throw new NotFoundException('المتقدم غير موجود');
    if (candidate.isTransferred) throw new BadRequestException('تم تحويل هذا المتقدم مسبقاً');

    const usersServiceUrl = process.env.USERS_SERVICE_URL || 'http://localhost:4002';
    const acceptedSalary = candidate.offers[0]?.basicSalary
      ? Number(candidate.offers[0].basicSalary)
      : extra.basicSalary;

    // إنشاء الموظف في users service
    const response = await firstValueFrom(
      this.http.post(`${usersServiceUrl}/api/v1/employees`, {
        firstNameAr: candidate.firstNameAr,
        lastNameAr: candidate.lastNameAr,
        firstNameEn: candidate.firstNameEn,
        lastNameEn: candidate.lastNameEn,
        email: candidate.email,
        phone: candidate.phone,
        nationalId: candidate.nationalId,
        departmentId: extra.departmentId,
        jobTitleId: extra.jobTitleId,
        hireDate: extra.hireDate || new Date().toISOString(),
        contractType: extra.contractType || 'INDEFINITE',
        basicSalary: acceptedSalary,
        gender: 'MALE', // قيمة افتراضية — يمكن تعديلها لاحقاً
      }, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      }),
    );

    if (response.status >= 400) {
      throw new BadRequestException(`فشل إنشاء الموظف: ${JSON.stringify(response.data)}`);
    }

    const employeeId = response.data?.data?.id || response.data?.id;

    // تحديث المتقدم
    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { isTransferred: true, transferredEmployeeId: employeeId, currentStage: 'HIRED' },
    });

    await this.prisma.candidateStageHistory.create({
      data: {
        candidateId,
        fromStage: candidate.currentStage,
        toStage: 'HIRED',
        notes: `تم تحويله لموظف — رقم الموظف: ${employeeId}`,
        changedBy: userId,
      },
    });

    return { success: true, employeeId, candidate: candidateId };
  }
}
