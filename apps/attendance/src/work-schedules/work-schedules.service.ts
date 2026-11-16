import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';

// الحاوية تعمل بتوقيت UTC بينما أوقات العمل بتوقيت +3 — نفس الثابت المستعمل بحسابات الحضور والرواتب
const BUSINESS_UTC_OFFSET_HOURS = 3;

@Injectable()
export class WorkSchedulesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWorkScheduleDto) {
    // Auto-generate code if not provided
    if (!dto.code) {
      const count = await this.prisma.workSchedule.count();
      dto.code = `VTX-ATT-${String(count + 1).padStart(6, '0')}`;
    }

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
      data: { ...dto, code: dto.code! },
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
      include: {
        employeeSchedules: {
          where: { isActive: true },
          select: {
            id: true,
            employeeId: true,
            effectiveFrom: true,
            effectiveTo: true,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'asc' },
        },
      },
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
    const before = await this.findOne(id);

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

    const timeChanged =
      (dto.workStartTime !== undefined && dto.workStartTime !== before.workStartTime) ||
      (dto.workEndTime !== undefined && dto.workEndTime !== before.workEndTime);

    const updated = await this.prisma.workSchedule.update({
      where: { id },
      data: dto,
    });

    // تعديل وقت الوردية يُسجَّل بتاريخ نفاذ (versioning) بدل ما يُستبدل القيمة الحية مباشرة —
    // السجلات الماضية تبقى تُحسب على الوقت القديم.
    //
    // النفاذ يبدأ من *بداية اليوم التالي* بتوقيت العمل (UTC+3)، مو من لحظة الحفظ: الموظفون
    // داوموا يوم التعديل على الوردية القديمة فعلاً، فاحتسابهم على الجديدة يجعلهم متأخرين
    // بلا ذنب. حفظ اللحظة نفسها كان يضع الحد في منتصف يوم التعديل، والمقارنة تتم بالتاريخ
    // وحده (بلا ساعة) فيقع اليوم كله مع النسخة الجديدة — وهذا ما ظهر على يوم 14/11/2026.
    if (timeChanged) {
      const nowBusiness = new Date(Date.now() + BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
      const effectiveFrom = new Date(Date.UTC(
        nowBusiness.getUTCFullYear(), nowBusiness.getUTCMonth(), nowBusiness.getUTCDate() + 1,
      ));
      await this.prisma.$executeRawUnsafe(
        `UPDATE attendance.work_schedule_time_history
         SET "effectiveTo" = $1
         WHERE "scheduleId" = $2 AND "effectiveTo" IS NULL`,
        effectiveFrom, id,
      );
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO attendance.work_schedule_time_history
           (id, "scheduleId", "workStartTime", "workEndTime", "effectiveFrom", "effectiveTo")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NULL)`,
        id, updated.workStartTime, updated.workEndTime, effectiveFrom,
      );
    }

    return updated;
  }

  async getActiveScheduleForEmployee(employeeId: string, date: Date) {
    const employeeSchedule = await this.prisma.employeeSchedule.findFirst({
      where: {
        employeeId,
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      include: { schedule: true },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!employeeSchedule) return null;

    // Check for custom schedule override (e.g., Ramadan)
    const customSchedule = await this.prisma.customWorkSchedule.findFirst({
      where: {
        scheduleId: employeeSchedule.scheduleId,
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    const schedule = employeeSchedule.schedule;
    return {
      ...schedule,
      workStartTime: customSchedule?.workStartTime ?? schedule.workStartTime,
      workEndTime: customSchedule?.workEndTime ?? schedule.workEndTime,
      breakStartTime: customSchedule?.breakStartTime ?? schedule.breakStartTime,
      breakEndTime: customSchedule?.breakEndTime ?? schedule.breakEndTime,
    };
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
