import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';

@Injectable()
export class WorkSchedulesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWorkScheduleDto) {
    // Check if code already exists
    const existing = await this.prisma.workSchedule.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'WORK_SCHEDULE_CODE_EXISTS',
        message: 'Work schedule code already exists',
        details: [{ code: dto.code }],
      });
    }

    return this.prisma.workSchedule.create({
      data: dto,
    });
  }

  async findAll(filters?: { isActive?: boolean }) {
    return this.prisma.workSchedule.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException({
        code: 'WORK_SCHEDULE_NOT_FOUND',
        message: 'Work schedule not found',
        details: [{ id }],
      });
    }

    return schedule;
  }

  async update(id: string, dto: UpdateWorkScheduleDto) {
    await this.findOne(id);

    // If updating code, check uniqueness
    if (dto.code) {
      const existing = await this.prisma.workSchedule.findFirst({
        where: {
          code: dto.code,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException({
          code: 'WORK_SCHEDULE_CODE_EXISTS',
          message: 'Work schedule code already exists',
          details: [{ code: dto.code }],
        });
      }
    }

    return this.prisma.workSchedule.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Check if schedule is assigned to any employees
    const assignedCount = await this.prisma.employeeSchedule.count({
      where: { scheduleId: id },
    });

    if (assignedCount > 0) {
      throw new BadRequestException({
        code: 'WORK_SCHEDULE_IN_USE',
        message: 'Cannot delete work schedule that is assigned to employees',
        details: [{ assignedEmployees: assignedCount }],
      });
    }

    return this.prisma.workSchedule.delete({
      where: { id },
    });
  }
}
