import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterviewPositionDto } from './dto/create-interview-position.dto';
import { UpdateInterviewPositionDto } from './dto/update-interview-position.dto';
import { CreateTechnicalQuestionDto } from './dto/create-technical-question.dto';

@Injectable()
export class InterviewPositionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInterviewPositionDto) {
    return this.prisma.interviewPosition.create({
      data: {
        jobTitle: dto.jobTitle,
        department: dto.department,
        sectorName: dto.sectorName,
        workType: dto.workType,
        workMode: dto.workMode,
        committeeMembers: dto.committeeMembers ?? [],
        interviewDate: dto.interviewDate ? new Date(dto.interviewDate) : null,
        requiresLanguage: dto.requiresLanguage ?? true,
        requiresComputer: dto.requiresComputer ?? true,
      },
    });
  }

  async findAll(query: { status?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page ?? '1', 10);
    const limit = parseInt(query.limit ?? '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.interviewPosition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { evaluations: true } } },
      }),
      this.prisma.interviewPosition.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const position = await this.prisma.interviewPosition.findFirst({
      where: { id, deletedAt: null },
      include: {
        technicalQuestions: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        _count: { select: { evaluations: true } },
      },
    });
    if (!position) throw new NotFoundException('الشاغر غير موجود');
    return position;
  }

  async update(id: string, dto: UpdateInterviewPositionDto) {
    await this.findOne(id);
    return this.prisma.interviewPosition.update({
      where: { id },
      data: {
        ...(dto.jobTitle && { jobTitle: dto.jobTitle }),
        ...(dto.department && { department: dto.department }),
        ...(dto.sectorName !== undefined && { sectorName: dto.sectorName }),
        ...(dto.workType && { workType: dto.workType }),
        ...(dto.workMode && { workMode: dto.workMode }),
        ...(dto.committeeMembers && { committeeMembers: dto.committeeMembers }),
        ...(dto.interviewDate !== undefined && { interviewDate: dto.interviewDate ? new Date(dto.interviewDate) : null }),
        ...(dto.status && { status: dto.status }),
        ...(dto.requiresLanguage !== undefined && { requiresLanguage: dto.requiresLanguage }),
        ...(dto.requiresComputer !== undefined && { requiresComputer: dto.requiresComputer }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.interviewPosition.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  // ===== Technical Questions =====

  async addTechnicalQuestion(positionId: string, dto: CreateTechnicalQuestionDto) {
    await this.findOne(positionId);
    return this.prisma.technicalQuestion.create({
      data: {
        positionId,
        question: dto.question,
        maxScore: dto.maxScore ?? 10,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async updateTechnicalQuestion(positionId: string, questionId: string, dto: Partial<CreateTechnicalQuestionDto>) {
    const q = await this.prisma.technicalQuestion.findFirst({
      where: { id: questionId, positionId, deletedAt: null },
    });
    if (!q) throw new NotFoundException('السؤال غير موجود');

    return this.prisma.technicalQuestion.update({
      where: { id: questionId },
      data: {
        ...(dto.question && { question: dto.question }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
      },
    });
  }

  async removeTechnicalQuestion(positionId: string, questionId: string) {
    const q = await this.prisma.technicalQuestion.findFirst({
      where: { id: questionId, positionId, deletedAt: null },
    });
    if (!q) throw new NotFoundException('السؤال غير موجود');

    await this.prisma.technicalQuestion.update({
      where: { id: questionId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async getTechnicalQuestions(positionId: string) {
    await this.findOne(positionId);
    return this.prisma.technicalQuestion.findMany({
      where: { positionId, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // ===== Comparison =====

  async getComparison(positionId: string) {
    await this.findOne(positionId);

    const evaluations = await this.prisma.interviewEvaluation.findMany({
      where: { positionId },
      orderBy: { totalScore: 'desc' },
      select: {
        id: true,
        candidateName: true,
        personalScore: true,
        technicalScore: true,
        computerScore: true,
        totalScore: true,
        decision: true,
        evaluatedAt: true,
      },
    });

    const total = evaluations.length;
    const accepted = evaluations.filter(e => e.decision === 'ACCEPTED').length;

    return { positionId, total, accepted, candidates: evaluations };
  }
}
