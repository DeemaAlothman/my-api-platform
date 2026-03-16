import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';

@Injectable()
export class EvaluationPeriodsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { status?: string; page?: number | string; limit?: number | string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.evaluationPeriod.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.evaluationPeriod.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async findOne(id: string) {
    const period = await this.prisma.evaluationPeriod.findUnique({
      where: { id },
      include: {
        forms: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Evaluation period with ID ${id} not found`);
    }

    return period;
  }

  async create(createPeriodDto: CreatePeriodDto) {
    if (!createPeriodDto.code) {
      const count = await this.prisma.evaluationPeriod.count();
      createPeriodDto.code = `VTX-EVL-${String(count + 1).padStart(6, '0')}`;
    }
    // Check if code already exists
    const existing = await this.prisma.evaluationPeriod.findUnique({
      where: { code: createPeriodDto.code },
    });

    if (existing) {
      throw new BadRequestException(
        `Period with code ${createPeriodDto.code} already exists`,
      );
    }

    return this.prisma.evaluationPeriod.create({
      data: {
        ...createPeriodDto,
        code: createPeriodDto.code!,
        startDate: new Date(createPeriodDto.startDate),
        endDate: new Date(createPeriodDto.endDate),
      },
    });
  }

  async update(id: string, updatePeriodDto: UpdatePeriodDto) {
    await this.findOne(id);

    const data: any = { ...updatePeriodDto };

    if (updatePeriodDto.startDate) {
      data.startDate = new Date(updatePeriodDto.startDate);
    }

    if (updatePeriodDto.endDate) {
      data.endDate = new Date(updatePeriodDto.endDate);
    }

    return this.prisma.evaluationPeriod.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.findOne(id);

    // Check if period has forms
    const formsCount = await this.prisma.evaluationForm.count({
      where: { periodId: id },
    });

    if (formsCount > 0) {
      throw new BadRequestException(
        'Cannot delete period with existing evaluation forms',
      );
    }

    return this.prisma.evaluationPeriod.delete({
      where: { id },
    });
  }

  async openPeriod(id: string) {
    const period = await this.findOne(id);

    if (period.status === 'OPEN') {
      throw new BadRequestException('Period is already open');
    }

    return this.prisma.evaluationPeriod.update({
      where: { id },
      data: { status: 'OPEN' },
    });
  }

  async closePeriod(id: string) {
    const period = await this.findOne(id);

    if (period.status === 'CLOSED') {
      throw new BadRequestException('Period is already closed');
    }

    return this.prisma.evaluationPeriod.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }

  async generateForms(id: string, employeeIds?: string[]) {
    const period = await this.findOne(id);

    if (period.status === 'CLOSED') {
      throw new BadRequestException('Cannot generate forms for closed period');
    }

    // If no employeeIds provided, fetch all active employees
    let targetEmployeeIds: string[] = Array.isArray(employeeIds) ? employeeIds : [];
    if (targetEmployeeIds.length === 0) {
      try {
        const employees = (await this.prisma.$queryRawUnsafe(
          `SELECT id FROM users.employees WHERE "deletedAt" IS NULL`,
        )) as Array<{ id: string }>;
        targetEmployeeIds = Array.isArray(employees) ? employees.map((e) => e.id) : [];
        console.log(`[generateForms] fetched ${targetEmployeeIds.length} employees`);
      } catch (err) {
        console.error('[generateForms] failed to fetch employees:', err?.message);
        throw new BadRequestException(`Failed to fetch employees: ${err?.message}`);
      }
    }

    // Get active criteria
    const criteria = await this.prisma.evaluationCriteria.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const employeeId of targetEmployeeIds) {
      try {
        // Check if form already exists
        const existingForm = await this.prisma.evaluationForm.findUnique({
          where: {
            periodId_employeeId: {
              periodId: id,
              employeeId,
            },
          },
        });

        if (existingForm) {
          results.skipped++;
          continue;
        }

        // Create form with sections
        await this.prisma.evaluationForm.create({
          data: {
            periodId: id,
            employeeId,
            sections: {
              create: criteria.map((c) => ({
                criteriaId: c.id,
              })),
            },
          },
        });

        results.created++;
      } catch (error) {
        results.errors.push(`Failed to create form for employee ${employeeId}: ${error.message}`);
      }
    }

    return {
      periodId: id,
      ...results,
      total: targetEmployeeIds.length,
    };
  }
}
