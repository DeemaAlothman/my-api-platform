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

  // تحديث رصيد الإجازة
  private async updateLeaveBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    usedDays: number,
    pendingDays: number,
  ) {
    const balance = await this.prisma.leaveBalance.findFirst({
      where: { employeeId, leaveTypeId, year },
    });

    if (!balance) {
      throw new BadRequestException('Leave balance not found for this employee');
    }

    const newUsedDays = balance.usedDays + usedDays;
    const newPendingDays = balance.pendingDays + pendingDays;
    const newRemainingDays = balance.totalDays - newUsedDays - newPendingDays;

    return this.prisma.leaveBalance.update({
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

    // تحديث الحالة وحجز الأيام
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'PENDING_MANAGER',
        managerStatus: 'PENDING',
      },
      include: {
        leaveType: true,
      },
    });

    // تحديث الرصيد (إضافة إلى pending)
    if (balance) {
      await this.updateLeaveBalance(employeeId, request.leaveTypeId, year, 0, request.totalDays);
    }

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

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: newStatus,
        managerStatus: 'APPROVED',
        managerApprovedBy: managerId,
        managerApprovedAt: new Date(),
        managerNotes: dto.notes,
        hrStatus: request.leaveType.requiresApproval ? 'PENDING' : undefined,
      },
      include: {
        leaveType: true,
      },
    });

    await this.addHistory(
      id,
      'MANAGER_APPROVE',
      'PENDING_MANAGER',
      newStatus,
      managerId,
      dto.notes || 'Approved by manager',
    );

    // إذا تم الاعتماد النهائي، نحدث الرصيد
    if (newStatus === 'APPROVED') {
      const year = new Date(request.startDate).getFullYear();
      await this.updateLeaveBalance(
        request.employeeId,
        request.leaveTypeId,
        year,
        request.totalDays,
        -request.totalDays,
      );
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

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        managerStatus: 'REJECTED',
        managerApprovedBy: managerId,
        managerApprovedAt: new Date(),
        managerNotes: dto.notes,
      },
      include: {
        leaveType: true,
      },
    });

    // إرجاع الأيام من pending
    const year = new Date(request.startDate).getFullYear();
    await this.updateLeaveBalance(
      request.employeeId,
      request.leaveTypeId,
      year,
      0,
      -request.totalDays,
    );

    await this.addHistory(
      id,
      'MANAGER_REJECT',
      'PENDING_MANAGER',
      'REJECTED',
      managerId,
      dto.notes,
    );

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

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        hrStatus: 'APPROVED',
        hrApprovedBy: hrUserId,
        hrApprovedAt: new Date(),
        hrNotes: dto.notes,
      },
      include: {
        leaveType: true,
      },
    });

    // تحديث الرصيد (من pending إلى used)
    const year = new Date(request.startDate).getFullYear();
    await this.updateLeaveBalance(
      request.employeeId,
      request.leaveTypeId,
      year,
      request.totalDays,
      -request.totalDays,
    );

    await this.addHistory(
      id,
      'HR_APPROVE',
      'PENDING_HR',
      'APPROVED',
      hrUserId,
      dto.notes || 'Approved by HR',
    );

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

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        hrStatus: 'REJECTED',
        hrApprovedBy: hrUserId,
        hrApprovedAt: new Date(),
        hrNotes: dto.notes,
      },
      include: {
        leaveType: true,
      },
    });

    // إرجاع الأيام من pending
    const year = new Date(request.startDate).getFullYear();
    await this.updateLeaveBalance(
      request.employeeId,
      request.leaveTypeId,
      year,
      0,
      -request.totalDays,
    );

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

    // يمكن إلغاء الطلب فقط من قبل صاحبه أو HR
    // في حالة APPROVED يحتاج موافقة HR فقط
    if (request.status === 'CANCELLED') {
      throw new BadRequestException('Request is already cancelled');
    }

    const oldStatus = request.status;

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.cancelReason,
        cancelledBy: userId,
        cancelledAt: new Date(),
      },
      include: {
        leaveType: true,
      },
    });

    // إرجاع الرصيد
    const year = new Date(request.startDate).getFullYear();
    if (oldStatus === 'APPROVED') {
      // إرجاع من used
      await this.updateLeaveBalance(
        request.employeeId,
        request.leaveTypeId,
        year,
        -request.totalDays,
        0,
      );
    } else if (oldStatus === 'PENDING_MANAGER' || oldStatus === 'PENDING_HR') {
      // إرجاع من pending
      await this.updateLeaveBalance(
        request.employeeId,
        request.leaveTypeId,
        year,
        0,
        -request.totalDays,
      );
    }

    await this.addHistory(id, 'CANCEL', oldStatus, 'CANCELLED', userId, dto.cancelReason);

    return updated;
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

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.year) {
      where.startDate = {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31`),
      };
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // قائمة جميع الطلبات (للمدراء و HR)
  async findAll(filters?: any) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters?.year) {
      where.startDate = {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31`),
      };
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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
