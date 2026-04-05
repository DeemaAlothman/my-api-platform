import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterviewEvaluationDto, CriteriaScoreDto, TechnicalScoreDto } from './dto/create-interview-evaluation.dto';

@Injectable()
export class InterviewEvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  // ===== حساب الدرجات =====
  private calculateScores(
    personalScores: CriteriaScoreDto[],
    technicalScores: TechnicalScoreDto[],
    computerScores: CriteriaScoreDto[],
    technicalMaxScores: Record<string, number>,
  ) {
    // القسم الأول: صفات شخصية — 14 معيار × 5 = 70 → وزن 40%
    const personalSum = personalScores.reduce((s, x) => s + x.score, 0);
    const personalMax = personalScores.length * 5 || 70;
    const personalScore = personalMax > 0 ? (personalSum / personalMax) * 40 : 0;

    // القسم الثاني: أسئلة تقنية → وزن 40%
    const technicalSum = technicalScores.reduce((s, x) => s + x.score, 0);
    const technicalMax = technicalScores.reduce((s, x) => s + (technicalMaxScores[x.questionId] ?? 10), 0);
    const technicalScore = technicalMax > 0 ? (technicalSum / technicalMax) * 40 : 0;

    // القسم الثالث: مهارات حاسوبية — 3 معايير × 5 = 15 → وزن 20%
    const computerSum = computerScores.reduce((s, x) => s + x.score, 0);
    const computerMax = computerScores.length * 5 || 15;
    const computerScore = computerMax > 0 ? (computerSum / computerMax) * 20 : 0;

    const totalScore = Math.round((personalScore + technicalScore + computerScore) * 100) / 100;

    return {
      personalScore: Math.round(personalScore * 100) / 100,
      technicalScore: Math.round(technicalScore * 100) / 100,
      computerScore: Math.round(computerScore * 100) / 100,
      totalScore,
    };
  }

  async create(dto: CreateInterviewEvaluationDto, evaluatorId?: string) {
    // تحقق من وجود الشاغر
    const position = await this.prisma.interviewPosition.findFirst({
      where: { id: dto.positionId, deletedAt: null },
    });
    if (!position) throw new NotFoundException('الشاغر غير موجود');

    // جلب maxScore للأسئلة التقنية
    const technicalMaxScores: Record<string, number> = {};
    if (dto.technicalScores?.length) {
      const questions = await this.prisma.technicalQuestion.findMany({
        where: { id: { in: dto.technicalScores.map(t => t.questionId) } },
        select: { id: true, maxScore: true },
      });
      questions.forEach(q => { technicalMaxScores[q.id] = q.maxScore; });
    }

    const scores = this.calculateScores(
      dto.personalScores ?? [],
      dto.technicalScores ?? [],
      dto.computerScores ?? [],
      technicalMaxScores,
    );

    const evaluation = await this.prisma.interviewEvaluation.create({
      data: {
        positionId: dto.positionId,
        jobApplicationId: dto.jobApplicationId,
        candidateName: dto.candidateName,
        residence: dto.residence,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        maritalStatus: dto.maritalStatus,
        contactNumber: dto.contactNumber,
        academicDegree: dto.academicDegree,
        yearsOfExperience: dto.yearsOfExperience,
        expectedSalary: dto.expectedSalary,
        expectedJoinDate: dto.expectedJoinDate ? new Date(dto.expectedJoinDate) : null,
        generalNotes: dto.generalNotes,
        decision: dto.decision,
        proposedSalary: dto.proposedSalary,
        evaluatorId: evaluatorId ?? null,
        evaluatedAt: new Date(),
        ...scores,
        personalScores: dto.personalScores?.length
          ? { create: dto.personalScores.map(s => ({ criterionId: s.criterionId, score: s.score })) }
          : undefined,
        technicalScores: dto.technicalScores?.length
          ? { create: dto.technicalScores.map(s => ({ questionId: s.questionId, score: s.score })) }
          : undefined,
        computerScores: dto.computerScores?.length
          ? { create: dto.computerScores.map(s => ({ criterionId: s.criterionId, score: s.score })) }
          : undefined,
      },
      include: {
        personalScores: true,
        technicalScores: true,
        computerScores: true,
      },
    });

    return evaluation;
  }

  async findAll(query: { positionId?: string; decision?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page ?? '1', 10);
    const limit = parseInt(query.limit ?? '20', 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.positionId) where.positionId = query.positionId;
    if (query.decision) where.decision = query.decision;

    const [items, total] = await Promise.all([
      this.prisma.interviewEvaluation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { position: { select: { jobTitle: true, department: true } } },
      }),
      this.prisma.interviewEvaluation.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const evaluation = await this.prisma.interviewEvaluation.findUnique({
      where: { id },
      include: {
        position: true,
        personalScores: { include: { criterion: true } },
        technicalScores: { include: { question: true } },
        computerScores: { include: { criterion: true } },
      },
    });
    if (!evaluation) throw new NotFoundException('التقييم غير موجود');
    return evaluation;
  }

  async findByApplicationId(jobApplicationId: string) {
    const evaluation = await this.prisma.interviewEvaluation.findUnique({
      where: { jobApplicationId },
      include: {
        position: { select: { jobTitle: true, department: true } },
        personalScores: { include: { criterion: true } },
        technicalScores: { include: { question: true } },
        computerScores: { include: { criterion: true } },
      },
    });
    return evaluation; // null is fine — caller decides
  }

  async update(id: string, dto: Partial<CreateInterviewEvaluationDto>, _evaluatorId?: string) {
    const existing = await this.findOne(id);

    // إعادة حساب الدرجات إذا تغيرت
    let scores = {};
    const newPersonal = dto.personalScores ?? existing.personalScores.map(s => ({ criterionId: s.criterionId, score: s.score }));
    const newTechnical = dto.technicalScores ?? existing.technicalScores.map(s => ({ questionId: s.questionId, score: s.score }));
    const newComputer = dto.computerScores ?? existing.computerScores.map(s => ({ criterionId: s.criterionId, score: s.score }));

    if (dto.personalScores || dto.technicalScores || dto.computerScores) {
      const technicalMaxScores: Record<string, number> = {};
      if (newTechnical.length) {
        const questions = await this.prisma.technicalQuestion.findMany({
          where: { id: { in: newTechnical.map((t: any) => t.questionId) } },
          select: { id: true, maxScore: true },
        });
        questions.forEach(q => { technicalMaxScores[q.id] = q.maxScore; });
      }
      scores = this.calculateScores(newPersonal as any, newTechnical as any, newComputer as any, technicalMaxScores);
    }

    return this.prisma.interviewEvaluation.update({
      where: { id },
      data: {
        ...(dto.candidateName && { candidateName: dto.candidateName }),
        ...(dto.residence !== undefined && { residence: dto.residence }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
        ...(dto.maritalStatus !== undefined && { maritalStatus: dto.maritalStatus }),
        ...(dto.contactNumber !== undefined && { contactNumber: dto.contactNumber }),
        ...(dto.academicDegree !== undefined && { academicDegree: dto.academicDegree }),
        ...(dto.yearsOfExperience !== undefined && { yearsOfExperience: dto.yearsOfExperience }),
        ...(dto.expectedSalary !== undefined && { expectedSalary: dto.expectedSalary }),
        ...(dto.expectedJoinDate !== undefined && { expectedJoinDate: dto.expectedJoinDate ? new Date(dto.expectedJoinDate) : null }),
        ...(dto.generalNotes !== undefined && { generalNotes: dto.generalNotes }),
        ...(dto.decision && { decision: dto.decision }),
        ...(dto.proposedSalary !== undefined && { proposedSalary: dto.proposedSalary }),
        ...scores,
        ...(dto.personalScores && {
          personalScores: {
            deleteMany: {},
            create: dto.personalScores.map(s => ({ criterionId: s.criterionId, score: s.score })),
          },
        }),
        ...(dto.technicalScores && {
          technicalScores: {
            deleteMany: {},
            create: dto.technicalScores.map(s => ({ questionId: s.questionId, score: s.score })),
          },
        }),
        ...(dto.computerScores && {
          computerScores: {
            deleteMany: {},
            create: dto.computerScores.map(s => ({ criterionId: s.criterionId, score: s.score })),
          },
        }),
      },
      include: {
        personalScores: { include: { criterion: true } },
        technicalScores: { include: { question: true } },
        computerScores: { include: { criterion: true } },
      },
    });
  }

  async transferToEmployee(id: string) {
    const evaluation = await this.findOne(id);
    if (evaluation.isTransferred) throw new BadRequestException('تم نقل الدرجة مسبقاً');
    if (evaluation.decision !== 'ACCEPTED') throw new BadRequestException('لا يمكن نقل درجة مرشح غير مقبول');

    // إرسال للـ users-service (fire-and-forget)
    const usersUrl = process.env.USERS_SERVICE_URL || 'http://users:4002';
    this.http.post(`${usersUrl}/api/v1/employees/internal/interview-result`, {
      jobApplicationId: evaluation.jobApplicationId,
      totalScore: evaluation.totalScore,
      decision: evaluation.decision,
      proposedSalary: evaluation.proposedSalary,
    }).subscribe({ error: () => { /* silent fail */ } });

    return this.prisma.interviewEvaluation.update({
      where: { id },
      data: { isTransferred: true },
    });
  }
}
