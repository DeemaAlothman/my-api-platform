import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveSelfEvaluationDto } from './dto/save-self-evaluation.dto';
import { SaveManagerEvaluationDto } from './dto/save-manager-evaluation.dto';
import { HRReviewDto } from './dto/hr-review.dto';
import { GMApprovalDto } from './dto/gm-approval.dto';
import { CreateEvaluationFormDto } from './dto/create-evaluation-form.dto';
import { CurrentUser } from '../common/interfaces/user.interface';

@Injectable()
export class EvaluationFormsService {
  constructor(private prisma: PrismaService) {}

  private async resolveEmployeeId(userId: string): Promise<string | null> {
    const result = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      userId,
    );
    return result.length > 0 ? result[0].id : null;
  }

  async create(dto: CreateEvaluationFormDto) {
    // Check if period exists
    const period = await this.prisma.evaluationPeriod.findUnique({
      where: { id: dto.periodId },
    });

    if (!period) {
      throw new NotFoundException(`Period with ID ${dto.periodId} not found`);
    }

    // Check if form already exists for this employee in this period
    const existingForm = await this.prisma.evaluationForm.findUnique({
      where: {
        periodId_employeeId: {
          periodId: dto.periodId,
          employeeId: dto.employeeId,
        },
      },
    });

    if (existingForm) {
      throw new BadRequestException(
        `Evaluation form already exists for this employee in this period`,
      );
    }

    // Create the form with sections for all active criteria
    const criteria = await this.prisma.evaluationCriteria.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    const form = await this.prisma.evaluationForm.create({
      data: {
        periodId: dto.periodId,
        employeeId: dto.employeeId,
        evaluatorId: dto.evaluatorId,
        sections: {
          create: criteria.map((c) => ({
            criteriaId: c.id,
          })),
        },
      },
      include: {
        period: true,
        sections: {
          include: {
            criteria: true,
          },
        },
      },
    });

    return form;
  }

  async getMyForm(user: CurrentUser, periodId?: string) {
    // Resolve employee ID from user ID (JWT contains userId, forms use employeeId)
    const employees = (await this.prisma.$queryRawUnsafe(
      `SELECT id FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      user.userId,
    )) as Array<{ id: string }>;

    if (employees.length === 0) {
      throw new NotFoundException('No employee record found for your account');
    }

    const employeeId = employees[0].id;

    const where: any = { employeeId };

    if (periodId) {
      where.periodId = periodId;
    }

    const form = await this.prisma.evaluationForm.findFirst({
      where,
      include: {
        period: true,
        sections: {
          include: {
            criteria: true,
          },
          orderBy: {
            criteria: {
              displayOrder: 'asc',
            },
          },
        },
        goals: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!form) {
      throw new NotFoundException('No evaluation form found for you');
    }

    return form;
  }

  async findAll(user: CurrentUser, filters?: { periodId?: string; status?: string; employeeId?: string; page?: number | string; limit?: number | string }) {
    // Only HR can view all forms
    if (!user.permissions.includes('evaluation:forms:view-all')) {
      throw new ForbiddenException(
        'You do not have permission to view all forms',
      );
    }

    const where: any = {};
    if (filters?.periodId) where.periodId = filters.periodId;
    if (filters?.status) where.status = filters.status;
    if (filters?.employeeId) where.employeeId = filters.employeeId;

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.evaluationForm.findMany({
        where,
        include: { period: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.evaluationForm.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async findOne(id: string, user: CurrentUser) {
    const form = await this.prisma.evaluationForm.findUnique({
      where: { id },
      include: {
        period: true,
        sections: {
          include: {
            criteria: true,
          },
          orderBy: {
            criteria: {
              displayOrder: 'asc',
            },
          },
        },
        goals: true,
        peerEvaluations: true,
      },
    });

    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }

    // Check access: employee, evaluator, or HR
    const myEmployeeId = await this.resolveEmployeeId(user.userId);
    const hasAccess =
      (myEmployeeId !== null && form.employeeId === myEmployeeId) ||
      form.evaluatorId === user.userId ||
      user.permissions.includes('evaluation:forms:view-all');

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this form');
    }

    return form;
  }

  async saveSelfEvaluation(
    id: string,
    dto: SaveSelfEvaluationDto,
    user: CurrentUser,
  ) {
    const form = await this.findOne(id, user);

    // Verify this is the employee's form
    const myEmployeeId = await this.resolveEmployeeId(user.userId);
    if (!myEmployeeId || form.employeeId !== myEmployeeId) {
      throw new ForbiddenException('You can only edit your own evaluation');
    }

    // Check status
    if (
      form.status !== 'PENDING_SELF' &&
      form.selfStatus !== 'IN_PROGRESS'
    ) {
      throw new BadRequestException(
        'Self evaluation cannot be modified at this stage',
      );
    }

    // Update sections
    for (const section of dto.sections) {
      await this.prisma.evaluationSection.upsert({
        where: {
          formId_criteriaId: {
            formId: id,
            criteriaId: section.criteriaId,
          },
        },
        update: {
          selfScore: section.score,
          selfComments: section.comments,
        },
        create: {
          formId: id,
          criteriaId: section.criteriaId,
          selfScore: section.score,
          selfComments: section.comments,
        },
      });
    }

    // Update form
    return this.prisma.evaluationForm.update({
      where: { id },
      data: {
        selfStatus: 'IN_PROGRESS',
        selfComments: dto.comments,
      },
      include: {
        sections: {
          include: {
            criteria: true,
          },
        },
      },
    });
  }

  async submitSelfEvaluation(id: string, user: CurrentUser) {
    const form = await this.findOne(id, user);

    // Verify this is the employee's form
    const myEmployeeId = await this.resolveEmployeeId(user.userId);
    if (!myEmployeeId || form.employeeId !== myEmployeeId) {
      throw new ForbiddenException('You can only submit your own evaluation');
    }

    // Check status
    if (form.selfStatus === 'SUBMITTED') {
      throw new BadRequestException('Self evaluation already submitted');
    }

    // Verify all sections have scores
    const criteriaCount = await this.prisma.evaluationCriteria.count({
      where: { isActive: true },
    });

    const completedSections = await this.prisma.evaluationSection.count({
      where: {
        formId: id,
        selfScore: { not: null },
      },
    });

    if (completedSections < criteriaCount) {
      throw new BadRequestException(
        'Please complete all evaluation criteria before submitting',
      );
    }

    // Calculate self score
    const sections = await this.prisma.evaluationSection.findMany({
      where: { formId: id },
      include: { criteria: true },
    });

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const section of sections) {
      if (section.selfScore !== null) {
        const normalizedScore =
          (section.selfScore / section.criteria.maxScore) * 100;
        totalWeightedScore += normalizedScore * section.criteria.weight;
        totalWeight += section.criteria.weight;
      }
    }

    const selfScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    return this.prisma.evaluationForm.update({
      where: { id },
      data: {
        selfStatus: 'SUBMITTED',
        selfScore,
        selfSubmittedAt: new Date(),
        status: 'SELF_SUBMITTED',
      },
    });
  }

  async saveManagerEvaluation(
    id: string,
    dto: SaveManagerEvaluationDto,
    user: CurrentUser,
  ) {
    const form = await this.findOne(id, user);

    // Verify this is the manager's employee
    if (form.evaluatorId !== user.userId) {
      throw new ForbiddenException(
        'You can only evaluate your direct reports',
      );
    }

    // Check status
    if (form.status !== 'PENDING_MANAGER' && form.managerStatus !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Manager evaluation cannot be modified at this stage',
      );
    }

    // Update sections
    for (const section of dto.sections) {
      await this.prisma.evaluationSection.upsert({
        where: {
          formId_criteriaId: {
            formId: id,
            criteriaId: section.criteriaId,
          },
        },
        update: {
          managerScore: section.score,
          managerComments: section.comments,
        },
        create: {
          formId: id,
          criteriaId: section.criteriaId,
          managerScore: section.score,
          managerComments: section.comments,
        },
      });
    }

    // Update form
    return this.prisma.evaluationForm.update({
      where: { id },
      data: {
        managerStatus: 'IN_PROGRESS',
        managerComments: dto.comments,
        managerStrengths: dto.strengths,
        managerWeaknesses: dto.weaknesses,
        managerRecommendations: dto.recommendations,
      },
      include: {
        sections: {
          include: {
            criteria: true,
          },
        },
      },
    });
  }

  async submitManagerEvaluation(id: string, user: CurrentUser) {
    const form = await this.findOne(id, user);

    // Verify this is the manager's employee
    if (form.evaluatorId !== user.userId) {
      throw new ForbiddenException(
        'You can only submit evaluation for your direct reports',
      );
    }

    // Check status
    if (form.managerStatus === 'SUBMITTED') {
      throw new BadRequestException('Manager evaluation already submitted');
    }

    // Verify all sections have scores
    const criteriaCount = await this.prisma.evaluationCriteria.count({
      where: { isActive: true },
    });

    const completedSections = await this.prisma.evaluationSection.count({
      where: {
        formId: id,
        managerScore: { not: null },
      },
    });

    if (completedSections < criteriaCount) {
      throw new BadRequestException(
        'Please complete all evaluation criteria before submitting',
      );
    }

    // Calculate manager score
    const sections = await this.prisma.evaluationSection.findMany({
      where: { formId: id },
      include: { criteria: true },
    });

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const section of sections) {
      if (section.managerScore !== null) {
        const normalizedScore =
          (section.managerScore / section.criteria.maxScore) * 100;
        totalWeightedScore += normalizedScore * section.criteria.weight;
        totalWeight += section.criteria.weight;
      }
    }

    const managerScore =
      totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    // Calculate final score (average of self and manager)
    const finalScore = form.selfScore
      ? (form.selfScore + managerScore) / 2
      : managerScore;

    // Determine final rating
    let finalRating: string;
    if (finalScore >= 90) finalRating = 'EXCELLENT';
    else if (finalScore >= 80) finalRating = 'VERY_GOOD';
    else if (finalScore >= 70) finalRating = 'GOOD';
    else if (finalScore >= 60) finalRating = 'SATISFACTORY';
    else finalRating = 'NEEDS_IMPROVEMENT';

    return this.prisma.evaluationForm.update({
      where: { id },
      data: {
        managerStatus: 'SUBMITTED',
        managerScore,
        managerSubmittedAt: new Date(),
        finalScore,
        finalRating: finalRating as any,
        status: 'MANAGER_SUBMITTED',
      },
    });
  }

  async hrReview(id: string, dto: HRReviewDto, user: CurrentUser) {
    const form = await this.findOne(id, user);

    // Check permission
    if (!user.permissions.includes('evaluation:forms:hr-review')) {
      throw new ForbiddenException(
        'You do not have permission to perform HR review',
      );
    }

    // Check status
    if (form.status !== 'MANAGER_SUBMITTED' && form.status !== 'PENDING_HR_REVIEW') {
      throw new BadRequestException('Form is not ready for HR review');
    }

    return this.prisma.evaluationForm.update({
      where: { id },
      data: {
        hrReviewedBy: user.userId,
        hrReviewedAt: new Date(),
        hrComments: dto.comments,
        hrRecommendation: dto.recommendation,
        status: 'HR_REVIEWED',
      },
    });
  }

  async gmApproval(id: string, dto: GMApprovalDto, user: CurrentUser) {
    const form = await this.findOne(id, user);

    // Check permission
    if (!user.permissions.includes('evaluation:forms:gm-approval')) {
      throw new ForbiddenException(
        'You do not have permission to approve evaluations',
      );
    }

    // Check status
    if (form.status !== 'HR_REVIEWED' && form.status !== 'PENDING_GM_APPROVAL') {
      throw new BadRequestException('Form is not ready for GM approval');
    }

    return this.prisma.evaluationForm.update({
      where: { id },
      data: {
        gmApprovedBy: user.userId,
        gmApprovedAt: new Date(),
        gmStatus: dto.status,
        gmComments: dto.comments,
        status: dto.status === 'APPROVED' ? 'COMPLETED' : 'PENDING_HR_REVIEW',
      },
    });
  }

  async getPendingMyReview(user: CurrentUser) {
    // Get forms where user is the evaluator and status is PENDING_MANAGER
    return this.prisma.evaluationForm.findMany({
      where: {
        evaluatorId: user.userId,
        status: {
          in: ['SELF_SUBMITTED', 'PENDING_MANAGER'],
        },
      },
      include: {
        period: true,
      },
      orderBy: {
        selfSubmittedAt: 'asc',
      },
    });
  }
}
