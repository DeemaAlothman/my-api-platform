import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProbationEvaluationDto, WorkflowActionDto } from './dto/create-probation-evaluation.dto';

@Injectable()
export class ProbationEvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  async create(dto: CreateProbationEvaluationDto) {
    const evaluation = await this.prisma.probationEvaluation.create({
      data: {
        employeeId: dto.employeeId,
        hireDate: new Date(dto.hireDate),
        probationEndDate: new Date(dto.probationEndDate),
        evaluationDate: dto.evaluationDate ? new Date(dto.evaluationDate) : null,
        evaluatorId: dto.evaluatorId,
        evaluatorNotes: dto.evaluatorNotes,
        isDelegated: dto.isDelegated ?? false,
        delegationNote: dto.delegationNote,
        seniorManagerId: dto.seniorManagerId,
        workAreasNote: dto.workAreasNote,
        status: 'DRAFT',
      },
    });

    if (dto.scores?.length) {
      await this.prisma.probationCriteriaScore.createMany({
        data: dto.scores.map(s => ({
          evaluationId: evaluation.id,
          criteriaId: s.criteriaId,
          score: s.score,
        })),
        skipDuplicates: true,
      });
    }

    await this.logHistory(evaluation.id, 'CREATE', dto.evaluatorId, 'تم إنشاء التقييم');

    return this.findOne(evaluation.id);
  }

  async findAll() {
    return this.prisma.probationEvaluation.findMany({
      include: {
        scores: { include: { criteria: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({
      where: { id },
      include: {
        scores: { include: { criteria: true } },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    return evaluation;
  }

  async findByEmployee(employeeId: string) {
    return this.prisma.probationEvaluation.findMany({
      where: { employeeId },
      include: {
        scores: { include: { criteria: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: Partial<CreateProbationEvaluationDto>) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'DRAFT') {
      throw new BadRequestException('لا يمكن تعديل التقييم بعد إرساله');
    }

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: {
        ...(dto.hireDate && { hireDate: new Date(dto.hireDate) }),
        ...(dto.probationEndDate && { probationEndDate: new Date(dto.probationEndDate) }),
        ...(dto.evaluationDate !== undefined && { evaluationDate: dto.evaluationDate ? new Date(dto.evaluationDate) : null }),
        ...(dto.evaluatorNotes !== undefined && { evaluatorNotes: dto.evaluatorNotes }),
        ...(dto.isDelegated !== undefined && { isDelegated: dto.isDelegated }),
        ...(dto.delegationNote !== undefined && { delegationNote: dto.delegationNote }),
        ...(dto.seniorManagerId !== undefined && { seniorManagerId: dto.seniorManagerId }),
        ...(dto.workAreasNote !== undefined && { workAreasNote: dto.workAreasNote }),
      },
    });

    if (dto.scores?.length) {
      await this.prisma.probationCriteriaScore.deleteMany({ where: { evaluationId: id } });
      await this.prisma.probationCriteriaScore.createMany({
        data: dto.scores.map(s => ({
          evaluationId: id,
          criteriaId: s.criteriaId,
          score: s.score,
        })),
      });
    }

    return this.findOne(id);
  }

  async submit(id: string, performedBy: string, dto: WorkflowActionDto) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'DRAFT') {
      throw new BadRequestException('التقييم تم إرساله مسبقاً');
    }

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: { status: 'PENDING_SENIOR_MANAGER' },
    });

    await this.logHistory(id, 'SUBMIT', performedBy, dto.notes ?? 'تم إرسال التقييم للمدير المباشر');

    return this.findOne(id);
  }

  async seniorApprove(id: string, performedBy: string, dto: WorkflowActionDto) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_SENIOR_MANAGER') {
      throw new BadRequestException('التقييم ليس في مرحلة مراجعة المدير المباشر');
    }

    const updateData: any = {
      status: 'PENDING_HR',
      overallRating: dto.overallRating,
      finalRecommendation: dto.recommendation,
    };

    if (dto.scores?.length) {
      await this.prisma.probationCriteriaScore.deleteMany({ where: { evaluationId: id } });
      await this.prisma.probationCriteriaScore.createMany({
        data: dto.scores.map(s => ({
          evaluationId: id,
          criteriaId: s.criteriaId,
          score: s.score,
        })),
      });
    }

    await this.prisma.probationEvaluation.update({ where: { id }, data: updateData });
    await this.logHistory(id, 'SENIOR_APPROVE', performedBy, dto.notes ?? 'اعتمد المدير المباشر التقييم');

    return this.findOne(id);
  }

  async seniorReject(id: string, performedBy: string, dto: WorkflowActionDto) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_SENIOR_MANAGER') {
      throw new BadRequestException('التقييم ليس في مرحلة مراجعة المدير المباشر');
    }

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: { status: 'REJECTED_BY_SENIOR' },
    });

    await this.logHistory(id, 'SENIOR_REJECT', performedBy, dto.notes ?? 'رفض المدير المباشر التقييم');

    return this.findOne(id);
  }

  async hrDocument(id: string, performedBy: string, dto: WorkflowActionDto) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_HR') {
      throw new BadRequestException('التقييم ليس في مرحلة توثيق الموارد البشرية');
    }

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: {
        status: 'PENDING_CEO',
        hrManagerId: performedBy,
      },
    });

    await this.logHistory(id, 'HR_DOCUMENT', performedBy, dto.notes ?? 'تم توثيق التقييم من قِبل الموارد البشرية');

    return this.findOne(id);
  }

  async hrReject(id: string, performedBy: string, dto: WorkflowActionDto) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_HR') {
      throw new BadRequestException('التقييم ليس في مرحلة توثيق الموارد البشرية');
    }

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: { status: 'REJECTED_BY_HR', hrManagerId: performedBy },
    });

    await this.logHistory(id, 'HR_REJECT', performedBy, dto.notes ?? 'رفضت الموارد البشرية التقييم');

    return this.findOne(id);
  }

  async ceoDecide(id: string, performedBy: string, dto: WorkflowActionDto) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_CEO') {
      throw new BadRequestException('التقييم ليس في مرحلة قرار الرئيس التنفيذي');
    }

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: {
        status: 'PENDING_MEETING_SCHEDULE',
        ceoId: performedBy,
        finalRecommendation: dto.recommendation ?? evaluation.finalRecommendation,
        overallRating: dto.overallRating ?? evaluation.overallRating,
      },
    });

    await this.logHistory(id, 'CEO_DECIDE', performedBy, dto.notes ?? 'أصدر الرئيس التنفيذي قراره — في انتظار جدولة الاجتماع');

    return this.findOne(id);
  }

  async scheduleMeeting(id: string, performedBy: string, meetingProposedAt: Date) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_MEETING_SCHEDULE') {
      throw new BadRequestException('التقييم ليس في مرحلة جدولة الاجتماع');
    }

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: { meetingProposedAt },
    });

    await this.logHistory(id, 'MEETING_SCHEDULED', performedBy, `تم اقتراح موعد الاجتماع: ${meetingProposedAt.toISOString()}`);
    return this.findOne(id);
  }

  async confirmMeeting(id: string, performedBy: string, role: 'employee' | 'manager') {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_MEETING_SCHEDULE') {
      throw new BadRequestException('التقييم ليس في مرحلة جدولة الاجتماع');
    }

    const updateData: any = role === 'employee'
      ? { meetingConfirmedByEmployee: true }
      : { meetingConfirmedByManager: true };

    const updatedByEmployee = role === 'employee' ? true : (evaluation as any).meetingConfirmedByEmployee;
    const updatedByManager  = role === 'manager'  ? true : (evaluation as any).meetingConfirmedByManager;

    if (updatedByEmployee && updatedByManager) {
      updateData.meetingConfirmedAt = new Date();
    }

    await this.prisma.probationEvaluation.update({ where: { id }, data: updateData });
    await this.logHistory(id, 'MEETING_CONFIRMED', performedBy, `تأكيد الاجتماع من قِبل: ${role}`);
    return this.findOne(id);
  }

  async closeEvaluation(id: string, performedBy: string, decisionDocumentUrl?: string) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_MEETING_SCHEDULE') {
      throw new BadRequestException('التقييم ليس في مرحلة جدولة الاجتماع');
    }

    const completedAt = new Date();

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        decisionDocumentUrl: decisionDocumentUrl ?? (evaluation as any).decisionDocumentUrl,
        employeeAcknowledged: true,
        employeeAcknowledgedAt: completedAt,
      },
    });

    await this.logHistory(id, 'EVALUATION_CLOSED', performedBy, 'أغلق HR التقييم بعد الاجتماع');

    if (evaluation.finalRecommendation && evaluation.employeeId) {
      const usersUrl = process.env.USERS_SERVICE_URL || 'http://users:4002';
      this.http.post(`${usersUrl}/api/v1/employees/internal/probation-result`, {
        employeeId: evaluation.employeeId,
        result: evaluation.finalRecommendation,
        completedAt: completedAt.toISOString(),
      }).subscribe({ error: () => { /* silent fail */ } });
    }

    return this.findOne(id);
  }

  async employeeAcknowledge(id: string, performedBy: string, dto: WorkflowActionDto) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_EMPLOYEE_ACKNOWLEDGMENT') {
      throw new BadRequestException('التقييم ليس في مرحلة إقرار الموظف');
    }

    const completedAt = new Date();

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        employeeAcknowledged: true,
        employeeAcknowledgedAt: completedAt,
      },
    });

    await this.logHistory(id, 'EMPLOYEE_ACKNOWLEDGE', performedBy, dto.notes ?? 'أقرّ الموظف بالتقييم');

    // إشعار users-service بالنتيجة النهائية
    if (evaluation.finalRecommendation && evaluation.employeeId) {
      const usersUrl = process.env.USERS_SERVICE_URL || 'http://users:4002';
      this.http.post(`${usersUrl}/api/v1/employees/internal/probation-result`, {
        employeeId: evaluation.employeeId,
        result: evaluation.finalRecommendation,
        completedAt: completedAt.toISOString(),
      }).subscribe({ error: () => { /* silent fail */ } });
    }

    return this.findOne(id);
  }

  async findPendingMyAction(userId: string) {
    // Resolve employeeId from userId (employeeId stores employee record ID, not userId)
    const empResult = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      userId,
    );
    const employeeId = empResult.length > 0 ? empResult[0].id : null;

    const orConditions: any[] = [
      {
        evaluatorId: userId,
        status: { in: ['DRAFT', 'REJECTED_BY_SENIOR', 'REJECTED_BY_HR', 'REJECTED_BY_CEO'] },
      },
      { seniorManagerId: userId, status: 'PENDING_SENIOR_MANAGER' },
      ...(employeeId ? [{ seniorManagerId: employeeId, status: 'PENDING_SENIOR_MANAGER' }] : []),
    ];

    if (employeeId) {
      orConditions.push({ employeeId, status: 'PENDING_EMPLOYEE_ACKNOWLEDGMENT' });
    }

    return this.prisma.probationEvaluation.findMany({
      where: { OR: orConditions },
      include: {
        scores: { include: { criteria: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findHistory(id: string) {
    const exists = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('التقييم غير موجود');

    return this.prisma.probationEvaluationHistory.findMany({
      where: { evaluationId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async logHistory(evaluationId: string, action: string, performedBy: string, notes: string) {
    await this.prisma.probationEvaluationHistory.create({
      data: { evaluationId, action, performedBy, notes },
    });
  }
}
