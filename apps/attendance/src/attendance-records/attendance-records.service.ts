import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';

@Injectable()
export class AttendanceRecordsService {
  constructor(private prisma: PrismaService) {}

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
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
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

    return this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        date: startOfDay,
        clockInTime,
        clockInLocation: dto.location,
        notes: dto.notes,
        status: 'PRESENT',
      },
    });
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
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
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

    return this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        clockOutTime,
        clockOutLocation: dto.location,
      },
    });
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

    return this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: 'desc' },
    });
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

    return record;
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
