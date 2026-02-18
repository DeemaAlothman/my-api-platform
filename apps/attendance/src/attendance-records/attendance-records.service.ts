import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkSchedulesService } from '../work-schedules/work-schedules.service';
import { AttendanceAlertsService } from '../attendance-alerts/attendance-alerts.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';

@Injectable()
export class AttendanceRecordsService {
  constructor(
    private prisma: PrismaService,
    private workSchedulesService: WorkSchedulesService,
    private attendanceAlertsService: AttendanceAlertsService,
  ) {}

  private async getEmployeeNames(employeeIds: string[]) {
    if (employeeIds.length === 0) return new Map<string, any>();

    const employees = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "employeeNumber", "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn"
       FROM users.employees
       WHERE id::text = ANY($1::text[])`,
      employeeIds,
    )) as Array<{ id: string; employeeNumber: string; firstNameAr: string; lastNameAr: string; firstNameEn: string | null; lastNameEn: string | null }>;

    return new Map(employees.map(e => [e.id, {
      employeeNumber: e.employeeNumber,
      firstNameAr: e.firstNameAr,
      lastNameAr: e.lastNameAr,
      firstNameEn: e.firstNameEn,
      lastNameEn: e.lastNameEn,
    }]));
  }

  private parseTimeOnDate(timeStr: string, date: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  async checkIn(employeeId: string, dto: CheckInDto) {
    const now = new Date();
    const dateObj = dto.date ? new Date(dto.date) : now;

    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if already checked in today
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: {
         employeeId,
    date: startOfDay,  // ✅ استخدام التاريخ مباشرة
    clockInTime: { not: null },
    clockOutTime: null,
      },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'ALREADY_CHECKED_IN',
        message: 'Already checked in for today',
        details: [{ date: dateObj, clockInTime: existing.clockInTime }],
      });
    }

    const clockInTime = dto.checkInTime ? new Date(dto.checkInTime) : now;

    // Default values
    let status = 'PRESENT';
    let lateMinutes = 0;

    // Get employee's active work schedule
    const schedule = await this.workSchedulesService.getActiveScheduleForEmployee(employeeId, startOfDay);

    if (schedule) {
      // Check if today is a work day
      const workDays: number[] = JSON.parse(schedule.workDays);
      const dayOfWeek = startOfDay.getDay(); // 0=Sunday, 6=Saturday

      if (!workDays.includes(dayOfWeek)) {
        status = 'WEEKEND';
      } else {
        // Calculate late minutes
        const scheduledStart = this.parseTimeOnDate(schedule.workStartTime, startOfDay);
        const toleranceDeadline = new Date(scheduledStart.getTime() + schedule.lateToleranceMin * 60000);

        if (clockInTime > toleranceDeadline) {
          lateMinutes = Math.round((clockInTime.getTime() - scheduledStart.getTime()) / 60000);
          status = 'LATE';
        }
      }
    }

    const record = await this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        date: startOfDay,
        clockInTime,
        clockInLocation: dto.location,
        notes: dto.notes,
        status,
        lateMinutes,
      },
    });

    // Auto-create alert if late
    if (status === 'LATE') {
      await this.attendanceAlertsService.create({
        employeeId,
        date: startOfDay.toISOString().split('T')[0],
        alertType: 'LATE',
        severity: lateMinutes > 30 ? 'HIGH' : 'MEDIUM',
        message: `Employee checked in ${lateMinutes} minutes late`,
        messageAr: `الموظف تأخر ${lateMinutes} دقيقة`,
        attendanceRecordId: record.id,
      });
    }

    return record;
  }

  async checkOut(employeeId: string, dto: CheckOutDto) {
    const now = new Date();
    const dateObj = dto.date ? new Date(dto.date) : now;

    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    // Find today's check-in record
    const record = await this.prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        date: startOfDay,
        clockInTime: { not: null },
        clockOutTime: null,
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'NO_CHECK_IN_FOUND',
        message: 'No check-in record found for today',
        details: [{ date: dateObj }],
      });
    }

    const clockOutTime = dto.checkOutTime ? new Date(dto.checkOutTime) : now;
    const workedMinutes = Math.max(0, Math.round((clockOutTime.getTime() - record.clockInTime.getTime()) / 60000));

    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;
    let status = record.status; // Keep existing status (e.g., LATE)

    // Get employee's active work schedule
    const schedule = await this.workSchedulesService.getActiveScheduleForEmployee(employeeId, startOfDay);

    if (schedule) {
      const scheduledEnd = this.parseTimeOnDate(schedule.workEndTime, startOfDay);
      const earlyDeadline = new Date(scheduledEnd.getTime() - schedule.earlyLeaveToleranceMin * 60000);

      // Check early leave
      if (clockOutTime < earlyDeadline) {
        earlyLeaveMinutes = Math.round((scheduledEnd.getTime() - clockOutTime.getTime()) / 60000);
        // Only override status if not already LATE
        if (status !== 'LATE') {
          status = 'EARLY_LEAVE';
        }
      }

      // Check overtime
      if (schedule.allowOvertime && clockOutTime > scheduledEnd) {
        overtimeMinutes = Math.round((clockOutTime.getTime() - scheduledEnd.getTime()) / 60000);
        // Cap overtime if maxOvertimeHours is set
        if (schedule.maxOvertimeHours) {
          const maxOvertimeMin = schedule.maxOvertimeHours * 60;
          overtimeMinutes = Math.min(overtimeMinutes, maxOvertimeMin);
        }
      }
    }

    const updatedRecord = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        clockOutTime,
        clockOutLocation: dto.location,
        workedMinutes,
        earlyLeaveMinutes,
        overtimeMinutes,
        status,
      },
    });

    // Auto-create alert if early leave
    if (earlyLeaveMinutes > 0) {
      await this.attendanceAlertsService.create({
        employeeId,
        date: startOfDay.toISOString().split('T')[0],
        alertType: 'EARLY_LEAVE',
        severity: earlyLeaveMinutes > 60 ? 'HIGH' : 'MEDIUM',
        message: `Employee left ${earlyLeaveMinutes} minutes early`,
        messageAr: `الموظف غادر مبكراً بـ ${earlyLeaveMinutes} دقيقة`,
        attendanceRecordId: updatedRecord.id,
      });
    }

    return updatedRecord;
  }

  async create(dto: CreateAttendanceRecordDto) {
    const data: any = {
      employeeId: dto.employeeId,
      date: new Date(dto.date),
      status: dto.status || 'PRESENT',
      lateMinutes: dto.lateMinutes || 0,
      earlyLeaveMinutes: dto.earlyLeaveMinutes || 0,
    };

    if (dto.clockInTime) data.clockInTime = new Date(dto.clockInTime);
    if (dto.clockOutTime) data.clockOutTime = new Date(dto.clockOutTime);
    if (dto.workedMinutes !== undefined) data.workedMinutes = dto.workedMinutes;
    if (dto.overtimeMinutes !== undefined) data.overtimeMinutes = dto.overtimeMinutes;
    if (dto.clockInLocation) data.clockInLocation = dto.clockInLocation;
    if (dto.clockOutLocation) data.clockOutLocation = dto.clockOutLocation;
    if (dto.notes) data.notes = dto.notes;

    return this.prisma.attendanceRecord.create({
      data,
    });
  }

  async findAll(filters?: {
    employeeId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    return records.map((record: any) => ({
      ...record,
      employee: employeeMap.get(record.employeeId) || null,
    }));
  }

  async findOne(id: string) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'ATTENDANCE_RECORD_NOT_FOUND',
        message: 'Attendance record not found',
        details: [{ id }],
      });
    }

    const employeeMap = await this.getEmployeeNames([record.employeeId]);

    return {
      ...record,
      employee: employeeMap.get(record.employeeId) || null,
    };
  }

  async update(id: string, dto: UpdateAttendanceRecordDto) {
    await this.findOne(id);

    return this.prisma.attendanceRecord.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.attendanceRecord.delete({
      where: { id },
    });
  }

  async getMyAttendance(employeeId: string, filters?: { dateFrom?: string; dateTo?: string }) {
    return this.findAll({ ...filters, employeeId });
  }
}
