import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProbationCriteriaDto } from './dto/create-probation-criteria.dto';

@Injectable()
export class ProbationCriteriaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.probationCriteria.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async create(dto: CreateProbationCriteriaDto) {
    return this.prisma.probationCriteria.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        isCore: dto.isCore ?? false,
        isActive: dto.isActive ?? true,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: Partial<CreateProbationCriteriaDto>) {
    const item = await this.prisma.probationCriteria.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('المعيار غير موجود');

    return this.prisma.probationCriteria.update({
      where: { id },
      data: {
        ...(dto.nameAr && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deactivate(id: string) {
    const item = await this.prisma.probationCriteria.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('المعيار غير موجود');
    if (item.isCore) throw new NotFoundException('لا يمكن تعطيل معيار أساسي');

    return this.prisma.probationCriteria.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getByJobTitle(jobTitleId: string) {
    const overrides = await this.prisma.jobTitleCriteria.findMany({
      where: { jobTitleId },
      include: { criteria: true },
    });

    if (overrides.length === 0) {
      return this.findAll();
    }

    return overrides
      .filter(o => o.isEnabled)
      .sort((a, b) => (a.displayOrder ?? a.criteria.displayOrder) - (b.displayOrder ?? b.criteria.displayOrder))
      .map(o => o.criteria);
  }

  async setJobTitleCriteria(jobTitleId: string, criteriaIds: string[]) {
    await this.prisma.jobTitleCriteria.deleteMany({ where: { jobTitleId } });

    return this.prisma.jobTitleCriteria.createMany({
      data: criteriaIds.map((criteriaId, i) => ({
        jobTitleId,
        criteriaId,
        isEnabled: true,
        displayOrder: i + 1,
      })),
    });
  }
}
