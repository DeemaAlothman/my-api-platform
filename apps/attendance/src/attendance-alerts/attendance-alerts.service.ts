import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceAlertDto } from './dto/create-attendance-alert.dto';
import { UpdateAttendanceAlertDto } from './dto/update-attendance-alert.dto';

@Injectable()
export class AttendanceAlertsService {
  constructor(private prisma: PrismaService) {}

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

    const alerts = await this.prisma.attendanceAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const employeeIds = [...new Set(alerts.map((a: any) => a.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    return alerts.map((alert: any) => ({
      ...alert,
      employee: employeeMap.get(alert.employeeId) || null,
    }));
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

    const employeeMap = await this.getEmployeeNames([alert.employeeId]);

    return {
      ...alert,
      employee: employeeMap.get(alert.employeeId) || null,
    };
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
