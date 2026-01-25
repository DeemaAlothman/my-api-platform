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
}
