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

  // ── Notification helpers ──────────────────────────────────────────

  private async notifyUser(
    userId: string, titleAr: string, titleEn: string,
    messageAr: string, messageEn: string, justificationId: string,
  ) {
    try {
      await this.prisma.$queryRawUnsafe(`
        INSERT INTO users.notifications
          (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
        VALUES (gen_random_uuid(), $1, 'ATTENDANCE_JUSTIFICATION', $2, $3, $4, $5, $6::jsonb, false, NOW())
      `, userId, titleAr, titleEn, messageAr, messageEn, JSON.stringify({ justificationId }));
    } catch { /* silent */ }
  }

  private async notifyDirectManager(employeeId: string, titleAr: string, titleEn: string, messageAr: string, messageEn: string, justificationId: string) {
    try {
      const rows = (await this.prisma.$queryRawUnsafe(
        `SELECT e2."userId" FROM users.employees e
         JOIN users.employees e2 ON e2.id = e."managerId"
         WHERE e.id = $1 AND e."deletedAt" IS NULL LIMIT 1`,
        employeeId,
      )) as Array<{ userId: string | null }>;
      if (rows[0]?.userId) {
        await this.notifyUser(rows[0].userId, titleAr, titleEn, messageAr, messageEn, justificationId);
      }
    } catch { /* silent */ }
  }

  private async notifyHRTeam(titleAr: string, titleEn: string, messageAr: string, messageEn: string, justificationId: string) {
    try {
      const hrUsers = (await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT u.id as "userId" FROM users.users u
         JOIN users.user_roles ur ON ur."userId" = u.id
         JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
         JOIN users.permissions p ON p.id = rp."permissionId"
         WHERE p.name = 'attendance.justifications.hr-review' AND u."deletedAt" IS NULL`,
      )) as Array<{ userId: string }>;
      for (const hr of hrUsers) {
        await this.notifyUser(hr.userId, titleAr, titleEn, messageAr, messageEn, justificationId);
      }
    } catch { /* silent */ }
  }

  private async notifyEmployee(employeeId: string, titleAr: string, titleEn: string, messageAr: string, messageEn: string, justificationId: string) {
    try {
      const rows = (await this.prisma.$queryRawUnsafe(
        `SELECT "userId" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
        employeeId,
      )) as Array<{ userId: string | null }>;
      if (rows[0]?.userId) {
        await this.notifyUser(rows[0].userId, titleAr, titleEn, messageAr, messageEn, justificationId);
      }
    } catch { /* silent */ }
  }

  // ─────────────────────────────────────────────────────────────────

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

    // التحقق من عدم وجود تبرير سابق
    if (alert.justification) {
      throw new BadRequestException({
        code: 'JUSTIFICATION_ALREADY_EXISTS',
        message: 'A justification has already been submitted for this alert',
      });
    }

    // التحقق من المهلة (7 أيام من إنشاء التنبيه)
    const deadline = new Date(alert.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() > deadline) {
      throw new BadRequestException({
        code: 'JUSTIFICATION_DEADLINE_PASSED',
        message: 'The 7-day deadline for submitting a justification has passed',
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

    await this.notifyDirectManager(
      employeeId,
      'تبرير غياب بانتظار مراجعتك', 'Attendance Justification Awaiting Your Review',
      'قدّم أحد موظفيك تبريراً لتنبيه حضور يحتاج مراجعتك',
      'One of your employees submitted an attendance justification awaiting your review',
      justification.id,
    );

    return { ...justification, statusLabelAr: this.getStatusLabelAr(justification.status), employee: employeeMap.get(justification.employeeId) || null };
  }

  async findAll(filters?: {
    employeeId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number | string;
    limit?: number | string;
  }) {
    const where: any = {};
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.attendanceJustification.findMany({
        where,
        include: { alert: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.attendanceJustification.count({ where }),
    ]);

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    const items = records.map((r: any) => ({ ...r, statusLabelAr: this.getStatusLabelAr(r.status), employee: employeeMap.get(r.employeeId) || null }));

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  private getStatusLabelAr(status: string): string {
    const labels: Record<string, string> = {
      PENDING_MANAGER:  'في انتظار موافقة المدير المباشر',
      MANAGER_APPROVED: 'تمت الموافقة من المدير المباشر',
      PENDING_HR:       'في انتظار موافقة الموارد البشرية',
      HR_APPROVED:      'تم إقرار الطلب',
      HR_REJECTED:      'تم رفض الطلب',
      AUTO_REJECTED:    'رُفض تلقائياً لانتهاء المهلة',
    };
    return labels[status] ?? status;
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
    return {
      ...record,
      statusLabelAr: this.getStatusLabelAr(record.status),
      employee: employeeMap.get(record.employeeId) || null,
    };
  }

  async findMine(employeeId: string, filters?: { status?: string; page?: number | string; limit?: number | string }) {
    return this.findAll({ employeeId, ...filters });
  }

  async getMyTeamJustifications(managerEmployeeId: string, filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number | string;
    limit?: number | string;
  }) {
    const subordinates = (await this.prisma.$queryRawUnsafe(
      `SELECT id FROM users.employees WHERE "managerId" = $1 AND "deletedAt" IS NULL`,
      managerEmployeeId,
    )) as Array<{ id: string }>;
    if (!subordinates.length) {
      return { items: [], page: 1, limit: 10, total: 0, totalPages: 1 };
    }
    const subordinateIds = subordinates.map(s => s.id);

    const where: any = { employeeId: { in: subordinateIds } };
    if (filters?.status) where.status = filters.status;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.attendanceJustification.findMany({
        where,
        include: { alert: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.attendanceJustification.count({ where }),
    ]);

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    const items = records.map((r: any) => ({ ...r, statusLabelAr: this.getStatusLabelAr(r.status), employee: employeeMap.get(r.employeeId) || null }));

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
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
      // المدير وافق → ينتقل لـ HR للقرار النهائي
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
      await this.notifyHRTeam(
        'تبرير غياب بانتظار مراجعة HR', 'Attendance Justification Awaiting HR Review',
        'وافق المدير المباشر على تبرير حضور ويحتاج قراراً نهائياً من الموارد البشرية',
        'The direct manager approved an attendance justification awaiting HR final decision',
        id,
      );
      return this.findOne(id);
    } else {
      // المدير رفض → ينتهي الطلب بالرفض وتُطبَّق الخصومات
      await this.prisma.attendanceJustification.update({
        where: { id },
        data: {
          status: 'HR_REJECTED',
          managerReviewedBy: managerId,
          managerReviewedAt: new Date(),
          managerNotes: dto.notes,
          managerNotesAr: dto.notesAr,
        },
      });
      await this.applyDeduction(id, justification.alertId);
      await this.notifyEmployee(
        justification.employeeId,
        'تم رفض تبريرك', 'Justification Rejected',
        'تم رفض تبرير الحضور الخاص بك من قِبل المدير المباشر وسيُطبَّق الخصم',
        'Your attendance justification was rejected by your manager and a deduction will be applied',
        id,
      );
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
      await this.restoreTardinessOffset(justification);
      await this.notifyEmployee(
        justification.employeeId,
        'تمت الموافقة على تبريرك', 'Justification Approved',
        'تمت الموافقة على تبرير الحضور الخاص بك من قِبل الموارد البشرية',
        'Your attendance justification has been approved by HR',
        id,
      );
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
      await this.notifyEmployee(
        justification.employeeId,
        'تم رفض تبريرك', 'Justification Rejected',
        'تم رفض تبرير الحضور الخاص بك من قِبل الموارد البشرية وسيُطبَّق الخصم',
        'Your attendance justification was rejected by HR and a deduction will be applied',
        id,
      );
      return this.findOne(id);
    }
  }

  async processExpired() {
    const now = new Date();

    // 1. تبريرات PENDING_MANAGER أو PENDING_HR انتهت مهلة المراجعة (7 أيام من تقديم التبرير)
    const managerDeadlineCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const expiredJustifications = await this.prisma.attendanceJustification.findMany({
      where: {
        status: { in: ['PENDING_MANAGER', 'PENDING_HR'] },
        createdAt: { lt: managerDeadlineCutoff },
      },
    });

    for (const j of expiredJustifications) {
      await this.prisma.attendanceJustification.update({
        where: { id: j.id },
        data: { status: 'AUTO_REJECTED' },
      });
      await this.applyDeduction(j.id, j.alertId);
    }

    // 2. تنبيهات LATE/EARLY_LEAVE/ABSENT بدون تبرير انتهت مهلتها (createdAt + 7 أيام)
    const alertsWithoutJustification = await this.prisma.attendanceAlert.findMany({
      where: {
        alertType: { in: ['LATE', 'EARLY_LEAVE', 'ABSENT'] },
        status: 'OPEN',
        createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
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
          deadline: new Date(alert.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
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

  /**
   * عند اعتماد تبرير التأخير: ابحث عن TARDINESS_AUTO للتاريخ نفسه وأعِد الرصيد
   */
  private async restoreTardinessOffset(justification: any): Promise<void> {
    try {
      if (!justification.attendanceRecordId) return;

      const recRow = (await this.prisma.$queryRawUnsafe(
        `SELECT date, "employeeId" FROM attendance.attendance_records WHERE id = $1 LIMIT 1`,
        justification.attendanceRecordId,
      )) as Array<{ date: Date; employeeId: string }>;

      if (!recRow[0]) return;

      const dateStr = recRow[0].date.toISOString().split('T')[0];
      const employeeId = recRow[0].employeeId;

      const autoOffsets = (await this.prisma.$queryRawUnsafe(
        `SELECT id, "durationHours", "leaveTypeId"
         FROM leaves.leave_requests
         WHERE "employeeId" = $1
           AND "isHourlyLeave" = true
           AND COALESCE(source, 'EMPLOYEE_REQUEST') = 'TARDINESS_AUTO'
           AND status = 'APPROVED'
           AND "startDate"::date = $2::date
           AND "deletedAt" IS NULL`,
        employeeId, dateStr,
      )) as Array<{ id: string; durationHours: number; leaveTypeId: string }>;

      if (!autoOffsets.length) return;

      const year = new Date(dateStr).getFullYear();
      const leaveTypeId = autoOffsets[0].leaveTypeId;
      const totalDurationHours = autoOffsets.reduce((sum, r) => sum + Number(r.durationHours), 0);

      // إلغاء جميع سجلات TARDINESS_AUTO للتاريخ (لا LIMIT 1 لتفادي تكرار السجلات)
      await this.prisma.$queryRawUnsafe(
        `UPDATE leaves.leave_requests
         SET status = 'CANCELLED', "cancelReason" = 'تم اعتماد تبرير التأخير', "cancelledAt" = NOW(), "updatedAt" = NOW()
         WHERE id = ANY($1::text[])`,
        autoOffsets.map(r => r.id),
      );

      // صفّر tardinessOffsetMinutes على سجل الحضور — التبرير معتمد، لا خصم من الرصيد
      if (justification.attendanceRecordId) {
        await this.prisma.$queryRawUnsafe(
          `UPDATE attendance.attendance_records
           SET "tardinessOffsetMinutes" = 0, "updatedAt" = NOW()
           WHERE id = $1`,
          justification.attendanceRecordId,
        );
      }

      // استعادة usedHours لكل السجلات الملغاة
      await this.prisma.$queryRawUnsafe(
        `UPDATE leaves.leave_balances
         SET "usedHours" = GREATEST(0, "usedHours" - $1), "updatedAt" = NOW()
         WHERE "employeeId" = $2 AND "leaveTypeId" = $3 AND year = $4`,
        totalDurationHours, employeeId, leaveTypeId, year,
      );

      // إشعار للموظف
      const userRow = (await this.prisma.$queryRawUnsafe(
        `SELECT "userId" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
        employeeId,
      )) as Array<{ userId: string | null }>;

      const userId = userRow[0]?.userId;
      if (userId) {
        const minutesRestored = Math.round(totalDurationHours * 60);
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications
             (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
           VALUES
             (gen_random_uuid(), $1, 'TARDINESS_OFFSET_RESTORED',
              'استعادة رصيد الإجازة الساعية', 'Hourly Leave Balance Restored',
              $2, $3, false, NOW())`,
          userId,
          `تمت إعادة ${minutesRestored} دقيقة لرصيدك بعد اعتماد تبرير التأخير بتاريخ ${dateStr}`,
          `${minutesRestored} min restored to your balance after tardiness justification approved on ${dateStr}`,
        );
      }
    } catch (err) {
      // استعادة الرصيد اختيارية — لا توقف عملية الاعتماد
      console.error(`[restoreTardinessOffset] failed: ${(err as any)?.message}`);
    }
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
