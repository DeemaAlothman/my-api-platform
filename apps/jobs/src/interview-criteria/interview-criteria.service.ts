import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCriterionDto } from './dto/create-criterion.dto';

@Injectable()
export class InterviewCriteriaService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Personal Criteria =====

  async getPersonalCriteria() {
    return this.prisma.personalCriterion.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createPersonalCriterion(dto: CreateCriterionDto) {
    return this.prisma.personalCriterion.create({
      data: {
        nameAr: dto.nameAr,
        description: dto.description,
        maxScore: dto.maxScore ?? 5,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePersonalCriterion(id: string, dto: Partial<CreateCriterionDto>) {
    const item = await this.prisma.personalCriterion.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('المعيار غير موجود');

    return this.prisma.personalCriterion.update({
      where: { id },
      data: {
        ...(dto.nameAr && { nameAr: dto.nameAr }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ===== Computer Criteria =====

  async getComputerCriteria() {
    return this.prisma.computerCriterion.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createComputerCriterion(dto: CreateCriterionDto) {
    return this.prisma.computerCriterion.create({
      data: {
        nameAr: dto.nameAr,
        description: dto.description,
        maxScore: dto.maxScore ?? 5,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateComputerCriterion(id: string, dto: Partial<CreateCriterionDto>) {
    const item = await this.prisma.computerCriterion.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('المعيار غير موجود');

    return this.prisma.computerCriterion.update({
      where: { id },
      data: {
        ...(dto.nameAr && { nameAr: dto.nameAr }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }
}
