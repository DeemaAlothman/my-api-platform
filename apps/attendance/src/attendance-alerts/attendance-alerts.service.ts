import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceAlertDto } from './dto/create-attendance-alert.dto';
import { UpdateAttendanceAlertDto } from './dto/update-attendance-alert.dto';

@Injectable()
export class AttendanceAlertsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAttendanceAlertDto) {
    const data: any = {
      employeeId: dto.employeeId,
      date: new Date(dto.date),
      alertType: dto.alertType,
      message: dto.message,
      status: dto.status || 'OPEN',
    };

    if (dto.severity) data.severity = dto.severity;
    if (dto.messageAr) data.messageAr = dto.messageAr;
    if (dto.attendanceRecordId) data.attendanceRecordId = dto.attendanceRecordId;

    return this.prisma.attendanceAlert.create({
      data,
    });
  }

  async findAll(filters?: {
    employeeId?: string;
    type?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};

    if (filters?.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters?.type) {
      where.alertType = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
    }

    return this.prisma.attendanceAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const alert = await this.prisma.attendanceAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException({
        code: 'ATTENDANCE_ALERT_NOT_FOUND',
        message: 'Attendance alert not found',
        details: [{ id }],
      });
    }

    return alert;
  }

  async update(id: string, dto: UpdateAttendanceAlertDto) {
    await this.findOne(id);

    return this.prisma.attendanceAlert.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.attendanceAlert.delete({
      where: { id },
    });
  }

  async markAsResolved(id: string, resolvedBy: string, resolutionNotes?: string) {
    await this.findOne(id);

    return this.prisma.attendanceAlert.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes,
      },
    });
  }

  async getMyAlerts(employeeId: string, filters?: { status?: string; type?: string }) {
    return this.findAll({ ...filters, employeeId });
  }
}
