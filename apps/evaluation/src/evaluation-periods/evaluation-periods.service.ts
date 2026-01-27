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

  async findAll() {
    return this.prisma.evaluationPeriod.findMany({
      orderBy: { createdAt: 'desc' },
    });
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

  async generateForms(id: string, employeeIds: string[]) {
    const period = await this.findOne(id);

    if (period.status === 'CLOSED') {
      throw new BadRequestException('Cannot generate forms for closed period');
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

    for (const employeeId of employeeIds) {
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
      total: employeeIds.length,
    };
  }
}
