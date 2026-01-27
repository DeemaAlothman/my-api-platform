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
    const where: any = {
      employeeId: user.userId,
    };

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

  async findAll(user: CurrentUser) {
    // Only HR can view all forms
    if (!user.permissions.includes('evaluation:forms:view-all')) {
      throw new ForbiddenException(
        'You do not have permission to view all forms',
      );
    }

    return this.prisma.evaluationForm.findMany({
      include: {
        period: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
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
    const hasAccess =
      form.employeeId === user.userId ||
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
    if (form.employeeId !== user.userId) {
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
    if (form.employeeId !== user.userId) {
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
