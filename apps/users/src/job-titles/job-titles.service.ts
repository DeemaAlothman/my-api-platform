import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobTitleDto } from './dto/create-job-title.dto';
import { UpdateJobTitleDto } from './dto/update-job-title.dto';
import { ListJobTitlesQueryDto } from './dto/list-job-titles.query.dto';

@Injectable()
export class JobTitlesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListJobTitlesQueryDto) {
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
      this.prisma.jobTitle.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: limit,
        include: {
          grade: { select: { id: true, code: true, nameAr: true, nameEn: true, minSalary: true, maxSalary: true } },
          _count: { select: { employees: true } },
        },
      }),
      this.prisma.jobTitle.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { items, page, limit, total, totalPages };
  }

  async findOne(id: string) {
    const jobTitle = await this.prisma.jobTitle.findFirst({
      where: { id, deletedAt: null },
      include: {
        grade: { select: { id: true, code: true, nameAr: true, nameEn: true, minSalary: true, maxSalary: true } },
        _count: { select: { employees: true } },
      },
    });

    if (!jobTitle) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Job title not found',
        details: [{ field: 'id', value: id }],
      });
    }

    return jobTitle;
  }

  async create(dto: CreateJobTitleDto) {
    const existing = await this.prisma.jobTitle.findFirst({
      where: { code: dto.code, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Job title code already exists',
        details: [{ field: 'code', value: dto.code }],
      });
    }

    return this.prisma.jobTitle.create({ data: dto });
  }

  async update(id: string, dto: UpdateJobTitleDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.jobTitle.findFirst({
        where: { code: dto.code, deletedAt: null, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException({
          code: 'RESOURCE_ALREADY_EXISTS',
          message: 'Job title code already exists',
          details: [{ field: 'code', value: dto.code }],
        });
      }
    }

    return this.prisma.jobTitle.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    const employeesCount = await this.prisma.employee.count({
      where: { jobTitleId: id, deletedAt: null },
    });

    if (employeesCount > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot delete job title with assigned employees',
        details: [{ field: 'employees', count: employeesCount }],
      });
    }

    await this.prisma.jobTitle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
