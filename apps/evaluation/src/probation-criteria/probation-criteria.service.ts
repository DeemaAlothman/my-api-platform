import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProbationCriteriaDto } from './dto/create-probation-criteria.dto';

@Injectable()
export class ProbationCriteriaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(employeeId?: string) {
    return this.prisma.probationCriteria.findMany({
      where: {
        isActive: true,
        OR: [
          { targetEmployeeId: null },
          ...(employeeId ? [{ targetEmployeeId: employeeId }] : []),
        ],
      },
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
        targetEmployeeId: dto.targetEmployeeId ?? null,
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
        ...(dto.targetEmployeeId !== undefined && { targetEmployeeId: dto.targetEmployeeId }),
      },
    });
  }

  async delete(id: string) {
    const item = await this.prisma.probationCriteria.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('المعيار غير موجود');
    if (item.isCore) throw new NotFoundException('لا يمكن حذف معيار أساسي');

    const usageCount = await this.prisma.probationCriteriaScore.count({ where: { criteriaId: id } });

    if (usageCount > 0) {
      // مستخدم في تقييمات → تعطيل آمن فقط
      return this.prisma.probationCriteria.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // غير مستخدم → حذف فعلي
    await this.prisma.jobTitleCriteria.deleteMany({ where: { criteriaId: id } });
    await this.prisma.probationCriteria.delete({ where: { id } });
    return { deleted: true };
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
