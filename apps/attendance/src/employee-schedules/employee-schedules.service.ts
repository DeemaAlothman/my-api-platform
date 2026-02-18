import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeScheduleDto } from './dto/create-employee-schedule.dto';
import { UpdateEmployeeScheduleDto } from './dto/update-employee-schedule.dto';

@Injectable()
export class EmployeeSchedulesService {
  constructor(private prisma: PrismaService) {}

  private async getEmployeeNames(employeeIds: string[]) {
    if (employeeIds.length === 0) return new Map<string, any>();

    const employees = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "employeeNumber", "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn"
       FROM users.employees
       WHERE id::text = ANY($1::text[])`,
      employeeIds,
    )) as Array<{
      id: string;
      employeeNumber: string;
      firstNameAr: string;
      lastNameAr: string;
      firstNameEn: string | null;
      lastNameEn: string | null;
    }>;

    return new Map(employees.map(e => [e.id, {
      employeeNumber: e.employeeNumber,
      firstNameAr: e.firstNameAr,
      lastNameAr: e.lastNameAr,
      firstNameEn: e.firstNameEn,
      lastNameEn: e.lastNameEn,
    }]));
  }

  async create(dto: CreateEmployeeScheduleDto) {
    // Verify schedule exists
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id: dto.scheduleId },
    });
    if (!schedule) {
      throw new NotFoundException({
        code: 'WORK_SCHEDULE_NOT_FOUND',
        message: 'Work schedule not found',
        details: [{ scheduleId: dto.scheduleId }],
      });
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'effectiveTo must be after effectiveFrom',
      });
    }

    // Deactivate any existing active schedule for the same employee (except the one being created)
    await this.prisma.employeeSchedule.updateMany({
      where: {
        employeeId: dto.employeeId,
        isActive: true,
        NOT: {
          AND: [
            { scheduleId: dto.scheduleId },
            { effectiveFrom },
          ],
        },
      },
      data: { isActive: false },
    });

    // Upsert: update if same (employeeId, scheduleId, effectiveFrom) already exists
    const record = await this.prisma.employeeSchedule.upsert({
      where: {
        employeeId_scheduleId_effectiveFrom: {
          employeeId: dto.employeeId,
          scheduleId: dto.scheduleId,
          effectiveFrom,
        },
      },
      update: {
        effectiveTo,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      create: {
        employeeId: dto.employeeId,
        scheduleId: dto.scheduleId,
        effectiveFrom,
        effectiveTo,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: { schedule: true },
    });

    const employeeMap = await this.getEmployeeNames([record.employeeId]);

    return {
      ...record,
      employee: employeeMap.get(record.employeeId) || null,
    };
  }

  async findAll(filters?: { employeeId?: string; scheduleId?: string; isActive?: boolean }) {
    const where: any = {};
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.scheduleId) where.scheduleId = filters.scheduleId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    const records = await this.prisma.employeeSchedule.findMany({
      where,
      include: { schedule: true },
      orderBy: { effectiveFrom: 'desc' },
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    return records.map((r: any) => ({
      ...r,
      employee: employeeMap.get(r.employeeId) || null,
    }));
  }

  async findOne(id: string) {
    const record = await this.prisma.employeeSchedule.findUnique({
      where: { id },
      include: { schedule: true },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'EMPLOYEE_SCHEDULE_NOT_FOUND',
        message: 'Employee schedule assignment not found',
        details: [{ id }],
      });
    }

    const employeeMap = await this.getEmployeeNames([record.employeeId]);

    return {
      ...record,
      employee: employeeMap.get(record.employeeId) || null,
    };
  }

  async findByEmployee(employeeId: string) {
    return this.findAll({ employeeId });
  }

  async update(id: string, dto: UpdateEmployeeScheduleDto) {
    const existing = await this.findOne(id);

    const data: any = {};
    if (dto.effectiveTo !== undefined) data.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.employeeSchedule.update({
      where: { id },
      data,
      include: { schedule: true },
    });

    const employeeMap = await this.getEmployeeNames([updated.employeeId]);

    return {
      ...updated,
      employee: employeeMap.get(updated.employeeId) || null,
    };
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.employeeSchedule.delete({
      where: { id },
    });
  }
}
