import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePeerEvaluationDto } from './dto/create-peer-evaluation.dto';
import { CurrentUser } from '../common/interfaces/user.interface';

@Injectable()
export class PeerEvaluationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    formId: string,
    dto: CreatePeerEvaluationDto,
    user: CurrentUser,
  ) {
    // Check if form exists
    const form = await this.prisma.evaluationForm.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException(`Form with ID ${formId} not found`);
    }

    // Check if user is trying to evaluate themselves
    if (form.employeeId === user.userId) {
      throw new BadRequestException('You cannot provide peer evaluation for yourself');
    }

    // Check if user already submitted peer evaluation for this form
    const existing = await this.prisma.peerEvaluation.findUnique({
      where: {
        formId_peerId: {
          formId,
          peerId: user.userId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You have already submitted peer evaluation for this employee',
      );
    }

    return this.prisma.peerEvaluation.create({
      data: {
        formId,
        peerId: user.userId,
        rating: dto.rating,
        strengths: dto.strengths,
        improvements: dto.improvements,
        comments: dto.comments,
        isAnonymous: dto.isAnonymous ?? true,
      },
    });
  }

  async findByForm(formId: string, user: CurrentUser) {
    // Check if form exists
    const form = await this.prisma.evaluationForm.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException(`Form with ID ${formId} not found`);
    }

    // Only employee, manager, or HR can view peer evaluations
    const hasAccess =
      form.employeeId === user.userId ||
      form.evaluatorId === user.userId ||
      user.permissions.includes('evaluation:forms:view-all');

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to these peer evaluations',
      );
    }

    const peerEvaluations = await this.prisma.peerEvaluation.findMany({
      where: { formId },
      orderBy: { submittedAt: 'desc' },
    });

    // If anonymous, remove peerId for non-HR users
    if (!user.permissions.includes('evaluation:forms:view-all')) {
      return peerEvaluations.map((pe) => {
        if (pe.isAnonymous) {
          return { ...pe, peerId: null };
        }
        return pe;
      });
    }

    return peerEvaluations;
  }
}
