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

  // تحديث رصيد الإجازة (يقبل transaction client اختياري لمنع race condition)
  private async updateLeaveBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    usedDays: number,
    pendingDays: number,
    tx?: any,
  ) {
    const client = tx ?? this.prisma;
    const balance = await client.leaveBalance.findFirst({
      where: { employeeId, leaveTypeId, year },
    });

    if (!balance) {
      throw new BadRequestException('Leave balance not found for this employee');
    }

    const newUsedDays = balance.usedDays + usedDays;
    const newPendingDays = balance.pendingDays + pendingDays;
    const newRemainingDays = (balance.totalDays + (balance.carriedOverDays ?? 0)) - newUsedDays - newPendingDays;

    return client.leaveBalance.update({
      where: { id: balance.id },
      data: {
        usedDays: newUsedDays,
        pendingDays: newPendingDays,
        remainingDays: newRemainingDays,
      },
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

    // تحديث الحالة وحجز الأيام (داخل transaction لمنع race condition)
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: { status: 'PENDING_MANAGER', managerStatus: 'PENDING' },
        include: { leaveType: true },
      });
      if (balance) {
        await this.updateLeaveBalance(employeeId, request.leaveTypeId, year, 0, request.totalDays, tx);
      }
      return result;
    });

    await this.addHistory(
      id,
      'SUBMIT',
      'DRAFT',
      'PENDING_MANAGER',
      employeeId,
      'Request submitted for manager approval',
    );

    return updated;
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
    }
  }

  // الحصول على طلب واحد
  async findOne(id: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
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
    const where: any = { employeeId };

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
    const where: any = {};

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

  // حذف طلب (فقط DRAFT)
  async remove(id: string, employeeId: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
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

    await this.prisma.leaveRequest.delete({
      where: { id },
    });

    return { message: 'Leave request deleted successfully' };
  }
}
