import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ApproveLeaveRequestDto, RejectLeaveRequestDto } from './dto/approve-leave-request.dto';
import { CancelLeaveRequestDto } from './dto/cancel-leave-request.dto';

@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  // حساب عدد أيام الإجازة
  private calculateLeaveDays(startDate: Date, endDate: Date, isHalfDay: boolean): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (isHalfDay) {
      return 0.5;
    }

    return diffDays;
  }

  // إضافة سجل في التاريخ
  private async addHistory(
    leaveRequestId: string,
    action: string,
    fromStatus: string | null,
    toStatus: string,
    performedBy: string,
    notes?: string,
  ) {
    return this.prisma.leaveRequestHistory.create({
      data: {
        leaveRequestId,
        action,
        fromStatus,
        toStatus,
        performedBy,
        notes,
      },
    });
  }

  // التحقق أن المستخدم هو المدير المباشر للموظف صاحب الطلب
  private async assertIsEmployeeManager(approverUserId: string, employeeId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ managerId: string | null; approverId: string | null }>>`
      SELECT e."managerId",
             (SELECT id FROM users.employees WHERE "userId" = ${approverUserId} AND "deletedAt" IS NULL LIMIT 1) AS "approverId"
      FROM users.employees e
      WHERE e.id = ${employeeId} AND e."deletedAt" IS NULL LIMIT 1
    `;
    const row = rows[0];
    if (!row || !row.approverId || row.managerId !== row.approverId) {
      throw new ForbiddenException({
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        message: 'You are not the direct manager of this employee',
        details: [],
      });
    }
  }

  // تحديث رصيد الإجازة — atomic increment/decrement لمنع race condition
  private async updateLeaveBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    usedDelta: number,
    pendingDelta: number,
    tx?: any,
  ) {
    const client = tx ?? this.prisma;
    const balance = await client.leaveBalance.findFirst({
      where: { employeeId, leaveTypeId, year },
      select: { id: true, totalDays: true, carriedOverDays: true },
    });

    if (!balance) {
      throw new BadRequestException('Leave balance not found for this employee');
    }

    const updated = await client.leaveBalance.update({
      where: { id: balance.id },
      data: {
        usedDays:    { increment: usedDelta },
        pendingDays: { increment: pendingDelta },
      },
      select: { usedDays: true, pendingDays: true, totalDays: true, carriedOverDays: true },
    });

    const remaining = (updated.totalDays + (updated.carriedOverDays ?? 0)) - updated.usedDays - updated.pendingDays;
    if (remaining < 0) {
      throw new BadRequestException('Insufficient leave balance');
    }

    return client.leaveBalance.update({
      where: { id: balance.id },
      data: { remainingDays: remaining },
    });
  }

  // إنشاء طلب إجازة (مسودة)
  async create(createDto: CreateLeaveRequestDto, employeeId: string) {
    const { leaveTypeId, startDate, endDate, isHalfDay = false, ...rest } = createDto;

    // التحقق من أن الموظف غير محذوف
    const empCheck = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users.employees WHERE id = ${employeeId} AND "deletedAt" IS NULL LIMIT 1
    `;
    if (!empCheck[0]) {
      throw new BadRequestException('الموظف غير موجود أو تم حذفه');
    }

    // التحقق من نوع الإجازة
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    });

    if (!leaveType || !leaveType.isActive) {
      throw new BadRequestException('Invalid or inactive leave type');
    }

    // حساب عدد الأيام
    const totalDays = this.calculateLeaveDays(new Date(startDate), new Date(endDate), isHalfDay);

    // التحقق من الحد الأقصى للأيام
    if (leaveType.maxDaysPerRequest && totalDays > leaveType.maxDaysPerRequest) {
      throw new BadRequestException(
        `Maximum ${leaveType.maxDaysPerRequest} days allowed per request`,
      );
    }

    // التحقق من مدة الإشعار المسبق
    if (leaveType.minDaysNotice) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const daysUntilStart = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilStart < leaveType.minDaysNotice) {
        throw new BadRequestException(`يجب تقديم الطلب قبل ${leaveType.minDaysNotice} يوم على الأقل`);
      }
    }

    // التحقق من المرفق المطلوب
    if (leaveType.requiresAttachment && !createDto.attachmentUrl) {
      throw new BadRequestException('هذا النوع من الإجازات يتطلب إرفاق مستند');
    }

    // التحقق من السماح بنصف يوم
    if (isHalfDay && !leaveType.allowHalfDay) {
      throw new BadRequestException('هذا النوع من الإجازات لا يسمح بطلب نصف يوم');
    }

    // التحقق من تداخل التواريخ مع إجازة قائمة
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED'] },
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) },
      },
    });
    if (overlapping) {
      throw new BadRequestException('يوجد إجازة أخرى في نفس الفترة أو تتداخل معها');
    }

    // إنشاء الطلب
    const request = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalDays,
        isHalfDay,
        status: 'DRAFT',
        ...rest,
      },
      include: {
        leaveType: true,
      },
    });

    // إضافة سجل
    await this.addHistory(request.id, 'CREATE', null, 'DRAFT', employeeId, 'Leave request created');

    return request;
  }

  // تحديث طلب إجازة (فقط في حالة DRAFT)
  async update(id: string, updateDto: UpdateLeaveRequestDto, employeeId: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (request.employeeId !== employeeId) {
      throw new ForbiddenException('You can only update your own requests');
    }

    if (request.status !== 'DRAFT') {
      throw new BadRequestException('Only draft requests can be updated');
    }

    let totalDays = request.totalDays;
    if (updateDto.startDate || updateDto.endDate || updateDto.isHalfDay !== undefined) {
      const start = updateDto.startDate ? new Date(updateDto.startDate) : request.startDate;
      const end = updateDto.endDate ? new Date(updateDto.endDate) : request.endDate;
      const isHalf = updateDto.isHalfDay !== undefined ? updateDto.isHalfDay : request.isHalfDay;
      totalDays = this.calculateLeaveDays(start, end, isHalf);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        ...updateDto,
        totalDays,
        startDate: updateDto.startDate ? new Date(updateDto.startDate) : undefined,
        endDate: updateDto.endDate ? new Date(updateDto.endDate) : undefined,
      },
      include: {
        leaveType: true,
      },
    });

    await this.addHistory(id, 'UPDATE', 'DRAFT', 'DRAFT', employeeId, 'Request updated');

    return updated;
  }

  // تقديم طلب الإجازة (من DRAFT إلى PENDING_MANAGER)
  async submit(id: string, employeeId: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { leaveType: true },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (request.employeeId !== employeeId) {
      throw new ForbiddenException('You can only submit your own requests');
    }

    if (request.status !== 'DRAFT') {
      throw new BadRequestException('Only draft requests can be submitted');
    }

    // التحقق من الرصيد
    const year = new Date(request.startDate).getFullYear();
    const balance = await this.prisma.leaveBalance.findFirst({
      where: {
        employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
      },
    });

    if (balance && balance.remainingDays < request.totalDays) {
      throw new BadRequestException('Insufficient leave balance');
    }

    const hasSubstitute = !!request.substituteId;
    const newStatus = hasSubstitute ? 'PENDING_SUBSTITUTE' : 'PENDING_MANAGER';

    // تحديث الحالة وحجز الأيام (داخل transaction لمنع race condition)
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: newStatus as any,
          managerStatus: hasSubstitute ? null : 'PENDING',
          substituteStatus: hasSubstitute ? 'PENDING' : null,
        },
        include: { leaveType: true },
      });
      if (balance) {
        await this.updateLeaveBalance(employeeId, request.leaveTypeId, year, 0, request.totalDays, tx);
      }
      return result;
    });

    await this.addHistory(id, 'SUBMIT', 'DRAFT', newStatus, employeeId,
      hasSubstitute ? 'Request submitted — awaiting substitute approval' : 'Request submitted for manager approval',
    );

    return updated;
  }

  async substituteApprove(id: string, substituteEmployeeId: string, notes?: string) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING_SUBSTITUTE') {
      throw new BadRequestException('Request is not awaiting substitute approval');
    }
    if (request.substituteId !== substituteEmployeeId) {
      throw new ForbiddenException('You are not the designated substitute for this request');
    }

    await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'PENDING_MANAGER' as any,
        managerStatus: 'PENDING',
        substituteStatus: 'APPROVED',
        substituteApprovedAt: new Date(),
        substituteNotes: notes,
      },
    });

    await this.addHistory(id, 'SUBSTITUTE_APPROVED', 'PENDING_SUBSTITUTE', 'PENDING_MANAGER', substituteEmployeeId,
      notes ?? 'Substitute approved the request',
    );

    return this.prisma.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
  }

  async substituteReject(id: string, substituteEmployeeId: string, notes: string) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING_SUBSTITUTE') {
      throw new BadRequestException('Request is not awaiting substitute approval');
    }
    if (request.substituteId !== substituteEmployeeId) {
      throw new ForbiddenException('You are not the designated substitute for this request');
    }

    await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED' as any,
        substituteStatus: 'REJECTED',
        substituteNotes: notes,
      },
    });

    await this.addHistory(id, 'SUBSTITUTE_REJECTED', 'PENDING_SUBSTITUTE', 'REJECTED', substituteEmployeeId, notes);

    return this.prisma.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
  }

  // موافقة المدير
  async approveByManager(id: string, dto: ApproveLeaveRequestDto, managerId: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { leaveType: true },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (request.status !== 'PENDING_MANAGER') {
      throw new BadRequestException('Request is not pending manager approval');
    }

    // managerId هنا فعليا userId — نتحقق أنه المدير المباشر للموظف
    await this.assertIsEmployeeManager(managerId, request.employeeId);

    // إذا كان النوع يتطلب موافقة HR، ننقله إلى PENDING_HR، وإلا نعتمده مباشرة
    const newStatus = request.leaveType.requiresApproval ? 'PENDING_HR' : 'APPROVED';

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: newStatus,
          managerStatus: 'APPROVED',
          managerApprovedBy: managerId,
          managerApprovedAt: new Date(),
          managerNotes: dto.notes,
          hrStatus: request.leaveType.requiresApproval ? 'PENDING_HR' : undefined,
        },
        include: { leaveType: true },
      });
      if (newStatus === 'APPROVED') {
        const year = new Date(request.startDate).getFullYear();
        await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, request.totalDays, -request.totalDays, tx);
      }
      return result;
    });

    await this.addHistory(id, 'MANAGER_APPROVE', 'PENDING_MANAGER', newStatus, managerId, dto.notes || 'Approved by manager');

    if (newStatus === 'APPROVED') {
      await this.createOnLeaveAttendanceRecords(request.employeeId, request.startDate, request.endDate);
    }

    return updated;
  }

  // رفض المدير
  async rejectByManager(id: string, dto: RejectLeaveRequestDto, managerId: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (request.status !== 'PENDING_MANAGER') {
      throw new BadRequestException('Request is not pending manager approval');
    }

    // managerId هنا فعليا userId — نتحقق أنه المدير المباشر للموظف
    await this.assertIsEmployeeManager(managerId, request.employeeId);

    const year = new Date(request.startDate).getFullYear();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          managerStatus: 'REJECTED',
          managerApprovedBy: managerId,
          managerApprovedAt: new Date(),
          managerNotes: dto.notes,
        },
        include: { leaveType: true },
      });
      await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, 0, -request.totalDays, tx);
      return result;
    });

    await this.addHistory(id, 'MANAGER_REJECT', 'PENDING_MANAGER', 'REJECTED', managerId, dto.notes);

    return updated;
  }

  // موافقة HR
  async approveByHR(id: string, dto: ApproveLeaveRequestDto, hrUserId: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (request.status !== 'PENDING_HR') {
      throw new BadRequestException('Request is not pending HR approval');
    }

    const year = new Date(request.startDate).getFullYear();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          hrStatus: 'APPROVED',
          hrApprovedBy: hrUserId,
          hrApprovedAt: new Date(),
          hrNotes: dto.notes,
        },
        include: { leaveType: true },
      });
      await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, request.totalDays, -request.totalDays, tx);
      return result;
    });

    await this.addHistory(id, 'HR_APPROVE', 'PENDING_HR', 'APPROVED', hrUserId, dto.notes || 'Approved by HR');

    await this.createOnLeaveAttendanceRecords(request.employeeId, request.startDate, request.endDate);

    return updated;
  }

  // رفض HR
  async rejectByHR(id: string, dto: RejectLeaveRequestDto, hrUserId: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (request.status !== 'PENDING_HR') {
      throw new BadRequestException('Request is not pending HR approval');
    }

    const year = new Date(request.startDate).getFullYear();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          hrStatus: 'REJECTED',
          hrApprovedBy: hrUserId,
          hrApprovedAt: new Date(),
          hrNotes: dto.notes,
        },
        include: { leaveType: true },
      });
      await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, 0, -request.totalDays, tx);
      return result;
    });

    await this.addHistory(id, 'HR_REJECT', 'PENDING_HR', 'REJECTED', hrUserId, dto.notes);

    return updated;
  }

  // إلغاء الطلب
  async cancel(id: string, dto: CancelLeaveRequestDto, userId: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    // يمكن إلغاء الطلب فقط من قبل صاحبه
    const empRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users.employees WHERE "userId" = ${userId} AND "deletedAt" IS NULL LIMIT 1
    `;
    const employeeId = empRows[0]?.id ?? null;
    if (!employeeId || request.employeeId !== employeeId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    if (request.status === 'CANCELLED') {
      throw new BadRequestException('Request is already cancelled');
    }

    const oldStatus = request.status;
    const year = new Date(request.startDate).getFullYear();

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelReason: dto.cancelReason,
          cancelledBy: userId,
          cancelledAt: new Date(),
        },
        include: { leaveType: true },
      });
      if (oldStatus === 'APPROVED') {
        await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, -request.totalDays, 0, tx);
      } else if (oldStatus === 'PENDING_MANAGER' || oldStatus === 'PENDING_HR') {
        await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, 0, -request.totalDays, tx);
      }
      return result;
    });

    await this.addHistory(id, 'CANCEL', oldStatus, 'CANCELLED', userId, dto.cancelReason);

    return updated;
  }

  // إنشاء سجلات ON_LEAVE في جدول الحضور عند اعتماد الإجازة
  private async createOnLeaveAttendanceRecords(employeeId: string, startDate: Date, endDate: Date): Promise<void> {
    try {
      const current = new Date(startDate);
      current.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO attendance.attendance_records (id, "employeeId", date, status, source, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2::date, 'ON_LEAVE', 'MANUAL', NOW(), NOW())
           ON CONFLICT ("employeeId", date) DO UPDATE SET status = 'ON_LEAVE', "updatedAt" = NOW()`,
          employeeId,
          dateStr,
        );
        current.setDate(current.getDate() + 1);
      }
    } catch (err) {
      console.error(`[createOnLeaveAttendanceRecords] failed for employee ${employeeId}:`, (err as any)?.message);
      // أنشئ alert في attendance ليعالجه HR يدوياً بدل ابتلاع الخطأ بصمت
      try {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO attendance.attendance_alerts
             (id, "employeeId", date, "alertType", severity, message, "messageAr", status, "isAutoGenerated", "createdAt", "updatedAt")
           VALUES
             (gen_random_uuid(), $1, $2::date, 'ON_LEAVE_SYNC_FAILED', 'HIGH',
              $3, $3, 'OPEN', true, NOW(), NOW())`,
          employeeId,
          new Date(startDate).toISOString().split('T')[0],
          `فشل إنشاء سجلات ON_LEAVE للفترة ${new Date(startDate).toISOString().split('T')[0]} - ${new Date(endDate).toISOString().split('T')[0]}: ${(err as any)?.message}`,
        );
      } catch (alertErr) {
        console.error('[createOnLeaveAttendanceRecords] also failed to create alert:', (alertErr as any)?.message);
      }
    }
  }

  // الحصول على طلب واحد
  async findOne(id: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        leaveType: true,
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    return request;
  }

  // قائمة طلبات الموظف
  async findByEmployee(employeeId: string, filters?: any) {
    const where: any = { employeeId, deletedAt: null };

    if (filters?.status) where.status = filters.status;
    if (filters?.leaveTypeId) where.leaveTypeId = filters.leaveTypeId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.startDate = {};
      if (filters.dateFrom) where.startDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.startDate.lte = new Date(filters.dateTo);
    }

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: { leaveType: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // قائمة جميع الطلبات (للمدراء و HR)
  async findAll(filters?: any) {
    const where: any = { deletedAt: null };

    if (filters?.status) where.status = filters.status;
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.leaveTypeId) where.leaveTypeId = filters.leaveTypeId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.startDate = {};
      if (filters.dateFrom) where.startDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.startDate.lte = new Date(filters.dateTo);
    }

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: { leaveType: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // حذف طلب (soft-delete — فقط DRAFT)
  async remove(id: string, employeeId: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, deletedAt: null },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (request.employeeId !== employeeId) {
      throw new ForbiddenException('You can only delete your own requests');
    }

    if (request.status !== 'DRAFT') {
      throw new BadRequestException('Only draft requests can be deleted');
    }

    await this.prisma.leaveRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Leave request deleted successfully' };
  }
}
