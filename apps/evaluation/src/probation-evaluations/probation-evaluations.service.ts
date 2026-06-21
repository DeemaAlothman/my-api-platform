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
    // إذا لم يُرسل المدير الأعلى، نجلبه تلقائياً من مدير الموظف المباشر
    // (وإلا تبقى خطوة الاعتماد بلا معتمِد وبلا إشعار)
    let seniorManagerId = dto.seniorManagerId ?? null;
    if (!seniorManagerId) {
      seniorManagerId = await this.resolveEmployeeManagerId(dto.employeeId);
    }

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
        seniorManagerId,
        workAreasNote: dto.workAreasNote,
        status: 'PENDING_SELF_EVALUATION',
      },
    });

    const allCriteria = await this.prisma.probationCriteria.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    if (allCriteria.length > 0) {
      await this.prisma.probationCriteriaScore.createMany({
        data: allCriteria.map(c => ({
          evaluationId: evaluation.id,
          criteriaId: c.id,
        })),
        skipDuplicates: true,
      });
    }

    // إشعار الموظف المُختار بأنّ عليه تعبئة التقييم الذاتي
    const empUserId = await this.resolveEmployeeUserId(dto.employeeId);
    if (empUserId) {
      await this.sendNotification(empUserId, 'EVALUATION_ASSIGNED',
        'تقييم فترة تجربة بانتظار تقييمك الذاتي',
        'Probation Evaluation Awaiting Your Self-Evaluation',
        'تم إنشاء تقييم فترة تجربتك — يرجى تعبئة التقييم الذاتي',
        'Your probation evaluation has been created — please complete your self-evaluation',
        { evaluationId: evaluation.id });
    }

    await this.logHistory(evaluation.id, 'CREATE', dto.evaluatorId, 'تم إنشاء التقييم — في انتظار التقييم الذاتي للموظف');

    return this.findOne(evaluation.id);
  }

  async findAll() {
    const evaluations = await this.prisma.probationEvaluation.findMany({
      include: {
        scores: { include: { criteria: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (evaluations.length === 0) return evaluations;

    const employeeIds = [...new Set(evaluations.map(e => e.employeeId))];
    const employees = await this.prisma.$queryRawUnsafe<Array<{
      id: string; firstNameAr: string; lastNameAr: string; firstNameEn: string; lastNameEn: string; employeeNumber: string;
    }>>(
      `SELECT id::text, "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn", "employeeNumber"
       FROM users.employees
       WHERE id::text IN (${employeeIds.map((_, i) => `$${i + 1}`).join(', ')})`,
      ...employeeIds,
    );
    const empMap = new Map(employees.map(e => [e.id, e]));

    return evaluations.map(ev => ({
      ...ev,
      employee: empMap.get(ev.employeeId) ?? null,
    }));
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

  async selfEvaluate(id: string, performedBy: string, dto: WorkflowActionDto) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_SELF_EVALUATION') {
      throw new BadRequestException('التقييم ليس في مرحلة التقييم الذاتي');
    }

    if (dto.scores?.length) {
      for (const s of dto.scores) {
        await this.prisma.probationCriteriaScore.upsert({
          where: { evaluationId_criteriaId: { evaluationId: id, criteriaId: s.criteriaId } },
          update: { selfScore: s.score },
          create: { evaluationId: id, criteriaId: s.criteriaId, selfScore: s.score },
        });
      }
    }

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: {
        status: 'PENDING_SENIOR_MANAGER',
        employeeNotes: dto.notes,
      },
    });

    await this.recomputeScores(id);

    // Notify senior manager (evaluatorId acts as direct manager in submit flow)
    if (evaluation.seniorManagerId) {
      const mgrUserId = await this.resolveEmployeeUserId(evaluation.seniorManagerId);
      if (mgrUserId) {
        await this.sendNotification(mgrUserId, 'EVALUATION_ASSIGNED',
          'بانتظار اعتمادك لتقييم فترة تجربة موظف',
          'Probation Evaluation Awaiting Your Review',
          'يوجد تقييم فترة تجربة بانتظار مراجعتك واعتمادك',
          'A probation evaluation is awaiting your review and approval',
          { evaluationId: id },
        );
      }
    }

    await this.logHistory(id, 'SELF_EVALUATE', performedBy, dto.notes ?? 'أكمل الموظف تقييمه الذاتي');

    return this.findOne(id);
  }

  async update(id: string, dto: Partial<CreateProbationEvaluationDto>) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (!['PENDING_SELF_EVALUATION'].includes(evaluation.status)) {
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
      for (const s of dto.scores) {
        await this.prisma.probationCriteriaScore.upsert({
          where: { evaluationId_criteriaId: { evaluationId: id, criteriaId: s.criteriaId } },
          update: { score: s.score },
          create: { evaluationId: id, criteriaId: s.criteriaId, score: s.score },
        });
      }
    }

    await this.prisma.probationEvaluation.update({ where: { id }, data: updateData });
    await this.recomputeScores(id);

    // Notify HR users
    const hrRows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      SELECT DISTINCT u.id FROM users.users u
      INNER JOIN users.user_roles ur ON ur."userId" = u.id
      INNER JOIN users.roles r ON r.id = ur."roleId"
      WHERE r.name IN ('HR', 'HR_Specialist', 'super_admin')
        AND r."deletedAt" IS NULL AND u."deletedAt" IS NULL
    `);
    for (const hr of hrRows) {
      await this.sendNotification(hr.id, 'EVALUATION_ASSIGNED',
        'تقييم فترة تجربة بانتظار توثيق الموارد البشرية',
        'Probation Evaluation Awaiting HR Documentation',
        'تم اعتماد تقييم فترة التجربة من المدير المباشر وينتظر توثيقك',
        'A probation evaluation has been approved by the manager and awaits your documentation',
        { evaluationId: id },
      );
    }

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

    // Notify evaluator (creator) of rejection
    if (evaluation.evaluatorId) {
      await this.sendNotification(evaluation.evaluatorId, 'EVALUATION_ASSIGNED',
        'تم رفض تقييم فترة التجربة',
        'Probation Evaluation Rejected',
        'رفض المدير المباشر تقييم فترة التجربة — يرجى المراجعة',
        'The probation evaluation was rejected by the senior manager — please review',
        { evaluationId: id },
      );
    }

    await this.logHistory(id, 'SENIOR_REJECT', performedBy, dto.notes ?? 'رفض المدير المباشر التقييم');

    return this.findOne(id);
  }

  async hrDocument(id: string, performedBy: string, dto: WorkflowActionDto) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_HR') {
      throw new BadRequestException('التقييم ليس في مرحلة توثيق الموارد البشرية');
    }

    // إذا كان المدير الأعلى هو نفسه المدير التنفيذي → نتخطّى خطوة CEO المكرّرة
    // (قراره ملتقَط أصلاً في مرحلة اعتماد المدير) ونروح مباشرة لجدولة الاجتماع
    const seniorIsCeo = await this.isEmployeeCeo(evaluation.seniorManagerId);

    if (seniorIsCeo) {
      await this.prisma.probationEvaluation.update({
        where: { id },
        data: {
          status: 'PENDING_MEETING_SCHEDULE',
          hrManagerId: performedBy,
          ceoId: evaluation.seniorManagerId,
        },
      });

      // إشعار HR بأنّ عليه تحديد موعد الاجتماع (تخطّينا خطوة CEO لأن المدير الأعلى هو التنفيذي)
      await this.notifyHr('PROBATION_REMINDER',
        'يلزم تحديد موعد اجتماع تقييم فترة التجربة',
        'Probation Meeting Needs Scheduling',
        'تم توثيق التقييم — يرجى تحديد موعد اجتماع لمراجعته',
        'The evaluation has been documented — please schedule the review meeting',
        { evaluationId: id });

      await this.logHistory(id, 'HR_DOCUMENT', performedBy,
        (dto.notes ?? 'تم توثيق التقييم من قِبل الموارد البشرية') +
        ' — المدير الأعلى هو المدير التنفيذي، تم تخطّي خطوة الاعتماد التنفيذي');

      return this.findOne(id);
    }

    await this.prisma.probationEvaluation.update({
      where: { id },
      data: {
        status: 'PENDING_CEO',
        hrManagerId: performedBy,
      },
    });

    // Notify CEO/super_admin users
    const ceoRows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      SELECT DISTINCT u.id FROM users.users u
      INNER JOIN users.user_roles ur ON ur."userId" = u.id
      INNER JOIN users.roles r ON r.id = ur."roleId"
      WHERE r.name IN ('CEO', 'super_admin')
        AND r."deletedAt" IS NULL AND u."deletedAt" IS NULL
    `);
    for (const ceo of ceoRows) {
      await this.sendNotification(ceo.id, 'EVALUATION_ASSIGNED',
        'بانتظار اعتمادك النهائي لتقييم فترة تجربة',
        'Probation Evaluation Awaiting Your Final Approval',
        'تقييم فترة تجربة موظف بانتظار اعتمادك النهائي',
        'A probation evaluation is awaiting your final approval',
        { evaluationId: id },
      );
    }

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
        finalRecommendation: (dto.recommendation ?? evaluation.finalRecommendation) as any,
        overallRating: dto.overallRating ?? evaluation.overallRating,
      },
    });

    // إشعار HR بأنّ عليه تحديد موعد الاجتماع
    await this.notifyHr('PROBATION_REMINDER',
      'يلزم تحديد موعد اجتماع تقييم فترة التجربة',
      'Probation Meeting Needs Scheduling',
      'صدر قرار التقييم — يرجى تحديد موعد اجتماع لمراجعته',
      'The evaluation decision has been issued — please schedule the review meeting',
      { evaluationId: id });

    await this.logHistory(id, 'CEO_DECIDE', performedBy, dto.notes ?? 'أصدر الرئيس التنفيذي قراره — في انتظار جدولة الاجتماع');

    return this.findOne(id);
  }

  async scheduleMeeting(id: string, performedBy: string, meetingProposedAt: Date) {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_MEETING_SCHEDULE') {
      throw new BadRequestException('التقييم ليس في مرحلة جدولة الاجتماع');
    }

    // HR يحدّد الموعد — نعيد ضبط الموافقات (موعد جديد = إعادة موافقة)
    await this.prisma.probationEvaluation.update({
      where: { id },
      data: {
        meetingProposedAt,
        meetingConfirmedByEmployee: false,
        meetingConfirmedByManager: false,
        meetingConfirmedByCeo: false,
        meetingConfirmedAt: null,
      } as any,
    });

    // إشعار أطراف الموافقة (الموظف + المدير المباشر + التنفيذي) للموافقة على الموعد
    // (الـ Set يدمج لو المدير المباشر هو نفسه التنفيذي → إشعار واحد)
    const dateStr = meetingProposedAt.toLocaleString('en-GB');
    await this.notifyMeetingApprovers(evaluation, 'PROBATION_REMINDER',
      'تم تحديد موعد اجتماع تقييم فترة التجربة — يرجى الموافقة',
      'Probation Meeting Date Set — Please Confirm',
      `حدّد HR موعد الاجتماع (${dateStr}) — يرجى الموافقة على الموعد`,
      `HR set the meeting date (${dateStr}) — please confirm`,
      { evaluationId: id });

    await this.logHistory(id, 'MEETING_SCHEDULED', performedBy, `حدّد HR موعد الاجتماع: ${meetingProposedAt.toISOString()}`);
    return this.findOne(id);
  }

  async confirmMeeting(id: string, performedBy: string, role: 'employee' | 'manager' | 'ceo') {
    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    if (evaluation.status !== 'PENDING_MEETING_SCHEDULE') {
      throw new BadRequestException('التقييم ليس في مرحلة جدولة الاجتماع');
    }

    const updateData: any = {};
    if (role === 'employee') updateData.meetingConfirmedByEmployee = true;
    else if (role === 'manager') updateData.meetingConfirmedByManager = true;
    else if (role === 'ceo') updateData.meetingConfirmedByCeo = true;

    const byEmp = role === 'employee' || (evaluation as any).meetingConfirmedByEmployee;
    const byMgr = role === 'manager' || (evaluation as any).meetingConfirmedByManager;
    const byCeo = role === 'ceo' || (evaluation as any).meetingConfirmedByCeo;

    // دمج: لو المدير المباشر هو نفسه التنفيذي → موافقة المدير تكفي عن التنفيذي
    const seniorIsCeo = await this.isEmployeeCeo(evaluation.seniorManagerId);
    const ceoSatisfied = seniorIsCeo ? byMgr : byCeo;

    const allConfirmed = byEmp && byMgr && ceoSatisfied;
    if (allConfirmed) {
      updateData.meetingConfirmedAt = new Date();
    }

    await this.prisma.probationEvaluation.update({ where: { id }, data: updateData });

    if (allConfirmed) {
      // وافق الجميع → إشعار HR بأنّ الموعد تأكّد وعليه إغلاق التقييم
      await this.notifyHr('PROBATION_REMINDER',
        'تأكّد موعد الاجتماع — يلزم إغلاق التقييم',
        'Meeting Confirmed — Evaluation Needs Closing',
        'وافق جميع الأطراف (الموظف + المدير المباشر + التنفيذي) على موعد الاجتماع — يرجى إغلاق التقييم',
        'All parties (employee + direct manager + executive) confirmed the meeting — please close the evaluation',
        { evaluationId: id });
    }

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

    await this.recomputeScores(id);
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
      }).subscribe({
        error: (err) => console.error(`[ProbationEval] فشل تحديث سجل الموظف: ${err?.message}`),
      });
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

  // أسماء أدوار المستخدم
  private async getUserRoleNames(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT r.name FROM users.user_roles ur
         JOIN users.roles r ON r.id = ur."roleId"
        WHERE ur."userId" = $1 AND r."deletedAt" IS NULL`,
      userId,
    );
    return rows.map((r) => r.name);
  }

  // كل تقييمات التجربة التي تنتظر إجراء/موافقة المستخدم الحالي (حسب دوره)
  async findPendingMyAction(userId: string) {
    const empResult = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      userId,
    );
    const employeeId = empResult.length > 0 ? empResult[0].id : null;
    const roles = await this.getUserRoleNames(userId);
    const isHr = roles.some((r) => ['HR', 'HR_Specialist', 'super_admin'].includes(r));
    const isCeo = roles.some((r) => ['CEO', 'CEOO', 'super_admin'].includes(r));

    const orConditions: any[] = [
      // كمُقيّم: مسودة أو مرفوضة (يحتاج إعادة عمل)
      { evaluatorId: userId, status: { in: ['DRAFT', 'REJECTED_BY_SENIOR', 'REJECTED_BY_HR', 'REJECTED_BY_CEO'] } },
    ];

    if (employeeId) {
      // كمدير مباشر: بانتظار اعتمادي
      orConditions.push({ seniorManagerId: employeeId, status: 'PENDING_SENIOR_MANAGER' });
      // كموظف: بانتظار إقراري
      orConditions.push({ employeeId, status: 'PENDING_EMPLOYEE_ACKNOWLEDGMENT' });
      // اجتماع بانتظار موافقتي (كموظف أو كمدير) ولم أوافق بعد
      orConditions.push({ employeeId, status: 'PENDING_MEETING_SCHEDULE', meetingConfirmedByEmployee: false });
      orConditions.push({ seniorManagerId: employeeId, status: 'PENDING_MEETING_SCHEDULE', meetingConfirmedByManager: false });
    }

    // كـ HR: بانتظار توثيقي
    if (isHr) orConditions.push({ status: 'PENDING_HR' });

    // كمدير تنفيذي: بانتظار قراري + اجتماع بانتظار موافقتي
    if (isCeo) {
      orConditions.push({ status: 'PENDING_CEO' });
      orConditions.push({ status: 'PENDING_MEETING_SCHEDULE', meetingConfirmedByCeo: false });
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

  async recomputeScores(evaluationId: string) {
    const scores = await this.prisma.probationCriteriaScore.findMany({
      where: { evaluationId },
    });
    if (scores.length === 0) return;

    const MAX_SCORE = 5;

    const managerScores = scores.filter(s => s.score !== null && s.score !== undefined);
    const selfScores = scores.filter(s => s.selfScore !== null && s.selfScore !== undefined);

    const managerScorePercent = managerScores.length > 0
      ? managerScores.reduce((sum, s) => sum + ((s.score! / MAX_SCORE) * 100), 0) / managerScores.length
      : null;

    const selfScorePercent = selfScores.length > 0
      ? selfScores.reduce((sum, s) => sum + ((s.selfScore! / MAX_SCORE) * 100), 0) / selfScores.length
      : null;

    const evaluation = await this.prisma.probationEvaluation.findUnique({ where: { id: evaluationId } });
    const mw = (evaluation as any)?.managerWeight ?? 0.7;
    const sw = (evaluation as any)?.selfWeight ?? 0.3;

    const finalScorePercent =
      managerScorePercent !== null && selfScorePercent !== null
        ? managerScorePercent * mw + selfScorePercent * sw
        : managerScorePercent ?? selfScorePercent;

    await this.prisma.probationEvaluation.update({
      where: { id: evaluationId },
      data: {
        managerScorePercent: managerScorePercent ?? undefined,
        selfScorePercent: selfScorePercent ?? undefined,
        finalScorePercent: finalScorePercent ?? undefined,
      } as any,
    });
  }

  private async sendNotification(
    userId: string,
    type: string,
    titleAr: string,
    titleEn: string,
    messageAr: string,
    messageEn: string,
    data?: Record<string, any>,
  ) {
    try {
      await this.prisma.$queryRawUnsafe(`
        INSERT INTO users.notifications
          (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
        VALUES
          (gen_random_uuid(), $1, $2::users."NotificationType", $3, $4, $5, $6, $7::jsonb, false, NOW())
      `, userId, type, titleAr, titleEn, messageAr, messageEn,
         data ? JSON.stringify(data) : null);
    } catch (e) {
      // فشل الإشعار غير حرج — لكن نسجّله للتشخيص بدل ابتلاعه بصمت
      console.warn(`[probation] notification failed: ${(e as any)?.message ?? e}`);
    }
  }

  private async resolveEmployeeUserId(employeeId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT "userId" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      employeeId,
    );
    return rows.length > 0 ? rows[0].userId : null;
  }

  // إشعار كل المشتركين بالتقييم: الموظف + المدير المباشر + التنفيذي + HR
  private async notifyAllInvolved(
    evaluation: any, type: string,
    titleAr: string, titleEn: string, messageAr: string, messageEn: string,
    data?: Record<string, any>,
  ) {
    const userIds = new Set<string>();
    // الموظف + المدير المباشر (تحويل employeeId → userId)
    for (const empId of [evaluation.employeeId, evaluation.seniorManagerId]) {
      if (empId) {
        const u = await this.resolveEmployeeUserId(empId);
        if (u) userIds.add(u);
      }
    }
    // التنفيذي + HR حسب الدور
    const roleUsers = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      SELECT DISTINCT u.id FROM users.users u
      INNER JOIN users.user_roles ur ON ur."userId" = u.id
      INNER JOIN users.roles r ON r.id = ur."roleId"
      WHERE r.name IN ('CEO', 'CEOO', 'HR', 'HR_Specialist', 'super_admin')
        AND r."deletedAt" IS NULL AND u."deletedAt" IS NULL
    `);
    for (const ru of roleUsers) userIds.add(ru.id);

    for (const uid of userIds) {
      await this.sendNotification(uid, type, titleAr, titleEn, messageAr, messageEn, data);
    }
  }

  // إشعار مستخدمي HR فقط
  private async notifyHr(
    type: string, titleAr: string, titleEn: string, messageAr: string, messageEn: string,
    data?: Record<string, any>,
  ) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      SELECT DISTINCT u.id FROM users.users u
      INNER JOIN users.user_roles ur ON ur."userId" = u.id
      INNER JOIN users.roles r ON r.id = ur."roleId"
      WHERE r.name IN ('HR', 'HR_Specialist', 'super_admin')
        AND r."deletedAt" IS NULL AND u."deletedAt" IS NULL
    `);
    for (const ru of rows) {
      await this.sendNotification(ru.id, type, titleAr, titleEn, messageAr, messageEn, data);
    }
  }

  // إشعار أطراف الموافقة على الاجتماع: الموظف + المدير المباشر + التنفيذي (مع دمج لو نفس الشخص)
  private async notifyMeetingApprovers(
    evaluation: any, type: string,
    titleAr: string, titleEn: string, messageAr: string, messageEn: string,
    data?: Record<string, any>,
  ) {
    const userIds = new Set<string>();
    for (const empId of [evaluation.employeeId, evaluation.seniorManagerId]) {
      if (empId) {
        const u = await this.resolveEmployeeUserId(empId);
        if (u) userIds.add(u);
      }
    }
    // التنفيذي حسب الدور
    const ceoRows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      SELECT DISTINCT u.id FROM users.users u
      INNER JOIN users.user_roles ur ON ur."userId" = u.id
      INNER JOIN users.roles r ON r.id = ur."roleId"
      WHERE r.name IN ('CEO', 'CEOO') AND r."deletedAt" IS NULL AND u."deletedAt" IS NULL
    `);
    for (const ru of ceoRows) userIds.add(ru.id);
    // الـ Set يضمن إشعار واحد لو المدير المباشر هو نفسه التنفيذي
    for (const uid of userIds) {
      await this.sendNotification(uid, type, titleAr, titleEn, messageAr, messageEn, data);
    }
  }

  // جلب مدير الموظف المباشر (managerId) من خدمة users
  private async resolveEmployeeManagerId(employeeId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ managerId: string | null }>>(
      `SELECT "managerId" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      employeeId,
    );
    return rows[0]?.managerId ?? null;
  }

  // هل هذا الموظف هو المدير التنفيذي (له دور CEO/CEOO)؟
  private async isEmployeeCeo(employeeId: string | null): Promise<boolean> {
    if (!employeeId) return false;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*)::int AS c
         FROM users.employees e
         JOIN users.user_roles ur ON ur."userId" = e."userId"
         JOIN users.roles r ON r.id = ur."roleId"
        WHERE e.id = $1 AND e."deletedAt" IS NULL
          AND r.name IN ('CEO', 'CEOO') AND r."deletedAt" IS NULL`,
      employeeId,
    );
    return (rows[0]?.c ?? 0) > 0;
  }

  private async logHistory(evaluationId: string, action: string, performedBy: string, notes: string) {
    await this.prisma.probationEvaluationHistory.create({
      data: { evaluationId, action, performedBy, notes },
    });
  }
}
