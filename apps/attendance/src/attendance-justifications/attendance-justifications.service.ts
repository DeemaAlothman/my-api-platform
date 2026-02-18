import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceJustificationDto } from './dto/create-attendance-justification.dto';
import { ManagerReviewDto } from './dto/manager-review.dto';
import { HrReviewDto } from './dto/hr-review.dto';

@Injectable()
export class AttendanceJustificationsService {
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

  async submit(employeeId: string, dto: CreateAttendanceJustificationDto) {
    // التحقق من وجود التنبيه
    const alert = await this.prisma.attendanceAlert.findUnique({
      where: { id: dto.alertId },
      include: { justification: true },
    });

    if (!alert) {
      throw new NotFoundException({
        code: 'ALERT_NOT_FOUND',
        message: 'Attendance alert not found',
        details: [{ alertId: dto.alertId }],
      });
    }

    // التحقق أن التنبيه خاص بالموظف نفسه
    if (alert.employeeId !== employeeId) {
      throw new ForbiddenException({
        code: 'ALERT_NOT_OWNED',
        message: 'You can only justify your own alerts',
      });
    }

    // التحقق أن التنبيه من النوع القابل للتبرير
    if (!['LATE', 'EARLY_LEAVE', 'ABSENT'].includes(alert.alertType)) {
      throw new BadRequestException({
        code: 'ALERT_TYPE_NOT_JUSTIFIABLE',
        message: 'Only LATE, EARLY_LEAVE, and ABSENT alerts can be justified',
      });
    }

    // التحقق من عدم وجود تبرير سابق
    if (alert.justification) {
      throw new BadRequestException({
        code: 'JUSTIFICATION_ALREADY_EXISTS',
        message: 'A justification has already been submitted for this alert',
      });
    }

    // التحقق من المهلة (24 ساعة من إنشاء التنبيه)
    const deadline = new Date(alert.createdAt.getTime() + 24 * 60 * 60 * 1000);
    if (new Date() > deadline) {
      throw new BadRequestException({
        code: 'JUSTIFICATION_DEADLINE_PASSED',
        message: 'The 24-hour deadline for submitting a justification has passed',
        details: [{ deadline: deadline.toISOString() }],
      });
    }

    // تحديث حالة التنبيه إلى ACKNOWLEDGED أولاً
    await this.prisma.attendanceAlert.update({
      where: { id: dto.alertId },
      data: { status: 'ACKNOWLEDGED' },
    });

    // إنشاء التبرير
    const justification = await this.prisma.attendanceJustification.create({
      data: {
        employeeId,
        alertId: dto.alertId,
        attendanceRecordId: alert.attendanceRecordId,
        justificationType: dto.justificationType,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        attachmentUrl: dto.attachmentUrl,
        deadline,
        status: 'PENDING_MANAGER',
      },
      include: { alert: true },
    });

    const employeeMap = await this.getEmployeeNames([justification.employeeId]);
    return { ...justification, employee: employeeMap.get(justification.employeeId) || null };
  }

  async findAll(filters?: {
    employeeId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const records = await this.prisma.attendanceJustification.findMany({
      where,
      include: { alert: true },
      orderBy: { createdAt: 'desc' },
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    return records.map((r: any) => ({ ...r, employee: employeeMap.get(r.employeeId) || null }));
  }

  async findOne(id: string) {
    const record = await this.prisma.attendanceJustification.findUnique({
      where: { id },
      include: { alert: true },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'JUSTIFICATION_NOT_FOUND',
        message: 'Attendance justification not found',
        details: [{ id }],
      });
    }

    const employeeMap = await this.getEmployeeNames([record.employeeId]);
    return { ...record, employee: employeeMap.get(record.employeeId) || null };
  }

  async findMine(employeeId: string, filters?: { status?: string }) {
    return this.findAll({ employeeId, ...filters });
  }

  async managerReview(id: string, managerId: string, dto: ManagerReviewDto) {
    const justification = await this.findOne(id);

    if (justification.status !== 'PENDING_MANAGER') {
      throw new BadRequestException({
        code: 'INVALID_JUSTIFICATION_STATUS',
        message: `Cannot review: justification is in status "${justification.status}"`,
      });
    }

    if (dto.decision === 'APPROVE') {
      // المدير وافق → حل التنبيه أولاً ثم تحديث التبرير
      await this.resolveAlert(justification.alertId, managerId, 'Justification approved by manager');
      await this.prisma.attendanceJustification.update({
        where: { id },
        data: {
          status: 'MANAGER_APPROVED',
          managerReviewedBy: managerId,
          managerReviewedAt: new Date(),
          managerNotes: dto.notes,
          managerNotesAr: dto.notesAr,
        },
      });
      return this.findOne(id);
    } else {
      // المدير رفض → ينتقل لـ HR
      await this.prisma.attendanceJustification.update({
        where: { id },
        data: {
          status: 'PENDING_HR',
          managerReviewedBy: managerId,
          managerReviewedAt: new Date(),
          managerNotes: dto.notes,
          managerNotesAr: dto.notesAr,
        },
      });
      return this.findOne(id);
    }
  }

  async hrReview(id: string, hrId: string, dto: HrReviewDto) {
    const justification = await this.findOne(id);

    if (justification.status !== 'PENDING_HR') {
      throw new BadRequestException({
        code: 'INVALID_JUSTIFICATION_STATUS',
        message: `Cannot review: justification is in status "${justification.status}"`,
      });
    }

    if (dto.decision === 'APPROVE') {
      // HR وافقت → حل التنبيه أولاً ثم تحديث التبرير
      await this.resolveAlert(justification.alertId, hrId, 'Justification approved by HR');
      await this.prisma.attendanceJustification.update({
        where: { id },
        data: {
          status: 'HR_APPROVED',
          hrReviewedBy: hrId,
          hrReviewedAt: new Date(),
          hrNotes: dto.notes,
          hrNotesAr: dto.notesAr,
        },
      });
      return this.findOne(id);
    } else {
      // HR رفضت → تطبيق الخصم أولاً ثم تحديث التبرير
      await this.prisma.attendanceJustification.update({
        where: { id },
        data: {
          status: 'HR_REJECTED',
          hrReviewedBy: hrId,
          hrReviewedAt: new Date(),
          hrNotes: dto.notes,
          hrNotesAr: dto.notesAr,
        },
      });
      await this.applyDeduction(id, justification.alertId);
      return this.findOne(id);
    }
  }

  async processExpired() {
    const now = new Date();

    // 1. تبريرات PENDING_MANAGER أو PENDING_HR انتهت مهلتها
    const expiredJustifications = await this.prisma.attendanceJustification.findMany({
      where: {
        status: { in: ['PENDING_MANAGER', 'PENDING_HR'] },
        deadline: { lt: now },
      },
    });

    for (const j of expiredJustifications) {
      await this.prisma.attendanceJustification.update({
        where: { id: j.id },
        data: { status: 'AUTO_REJECTED' },
      });
      await this.applyDeduction(j.id, j.alertId);
    }

    // 2. تنبيهات LATE/EARLY_LEAVE/ABSENT بدون تبرير انتهت مهلتها (createdAt + 24h)
    const alertsWithoutJustification = await this.prisma.attendanceAlert.findMany({
      where: {
        alertType: { in: ['LATE', 'EARLY_LEAVE', 'ABSENT'] },
        status: 'OPEN',
        createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        justification: null,
      },
    });

    for (const alert of alertsWithoutJustification) {
      // إنشاء تبرير AUTO_REJECTED
      const j = await this.prisma.attendanceJustification.create({
        data: {
          employeeId: alert.employeeId,
          alertId: alert.id,
          attendanceRecordId: alert.attendanceRecordId,
          justificationType: 'OTHER',
          descriptionAr: 'لم يتم تقديم تبرير خلال المهلة المحددة',
          deadline: new Date(alert.createdAt.getTime() + 24 * 60 * 60 * 1000),
          status: 'AUTO_REJECTED',
          deductionApplied: false,
        },
      });
      await this.applyDeduction(j.id, alert.id);
    }

    return {
      processedJustifications: expiredJustifications.length,
      processedAlerts: alertsWithoutJustification.length,
      total: expiredJustifications.length + alertsWithoutJustification.length,
    };
  }

  private async applyDeduction(justificationId: string, alertId: string) {
    // جلب بيانات التنبيه وسجل الحضور
    const alert = await this.prisma.attendanceAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert?.attendanceRecordId) return;

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: alert.attendanceRecordId },
    });

    if (!record) return;

    const deductionMinutes = (record.lateMinutes || 0) + (record.earlyLeaveMinutes || 0);

    // تحديث سجل الحضور بالخصم
    await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        deductionApplied: true,
        deductionMinutes,
      },
    });

    // تحديث التبرير
    await this.prisma.attendanceJustification.update({
      where: { id: justificationId },
      data: {
        deductionApplied: true,
        deductionMinutes,
      },
    });

    // تحديث حالة التنبيه
    await this.prisma.attendanceAlert.update({
      where: { id: alertId },
      data: { status: 'RESOLVED', resolutionNotes: 'Deduction applied' },
    });
  }

  private async resolveAlert(alertId: string, resolvedBy: string, notes: string) {
    await this.prisma.attendanceAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      },
    });
  }
}
