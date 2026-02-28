import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobGradeDto } from './dto/create-job-grade.dto';
import { UpdateJobGradeDto } from './dto/update-job-grade.dto';
import { ListJobGradesQueryDto } from './dto/list-job-grades.query.dto';

@Injectable()
export class JobGradesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListJobGradesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (query.search) {
      const s = query.search.trim();
      if (s.length > 0) {
        where.OR = [
          { code: { contains: s, mode: 'insensitive' } },
          { nameAr: { contains: s, mode: 'insensitive' } },
          { nameEn: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.jobGrade.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: limit,
        include: {
          _count: { select: { jobTitles: true } },
        },
      }),
      this.prisma.jobGrade.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { items, page, limit, total, totalPages };
  }

  async findOne(id: string) {
    const jobGrade = await this.prisma.jobGrade.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { jobTitles: true } },
        jobTitles: {
          where: { deletedAt: null },
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
      },
    });

    if (!jobGrade) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Job grade not found',
        details: [{ field: 'id', value: id }],
      });
    }

    return jobGrade;
  }

  async create(dto: CreateJobGradeDto) {
    const existing = await this.prisma.jobGrade.findFirst({
      where: { code: dto.code, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Job grade code already exists',
        details: [{ field: 'code', value: dto.code }],
      });
    }

    return this.prisma.jobGrade.create({ data: dto });
  }

  async update(id: string, dto: UpdateJobGradeDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.jobGrade.findFirst({
        where: { code: dto.code, deletedAt: null, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException({
          code: 'RESOURCE_ALREADY_EXISTS',
          message: 'Job grade code already exists',
          details: [{ field: 'code', value: dto.code }],
        });
      }
    }

    return this.prisma.jobGrade.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    const jobTitlesCount = await this.prisma.jobTitle.count({
      where: { gradeId: id, deletedAt: null },
    });

    if (jobTitlesCount > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot delete job grade with assigned job titles',
        details: [{ field: 'jobTitles', count: jobTitlesCount }],
      });
    }

    await this.prisma.jobGrade.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
