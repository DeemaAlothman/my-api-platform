import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ApproveLeaveRequestDto, RejectLeaveRequestDto } from './dto/approve-leave-request.dto';
import { CancelLeaveRequestDto } from './dto/cancel-leave-request.dto';
import { CreateHourlyLeaveDto } from './dto/create-hourly-leave.dto';

@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  // حساب عدد أيام الإجازة (يستثني العطل الرسمية وأيام العطلة الأسبوعية)
  private async calculateLeaveDays(
    startDate: Date,
    endDate: Date,
    isHalfDay: boolean,
    employeeId: string,
  ): Promise<number> {
    if (isHalfDay) return 0.5;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // جلب أيام العمل من جدول دوام الموظف (fallback: الأحد-الخميس)
    const scheduleRows = await this.prisma.$queryRaw<Array<{ workDays: string }>>`
      SELECT ws."workDays"
      FROM attendance.employee_schedules es
      JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
      WHERE es."employeeId" = ${employeeId} AND es."isActive" = true
      LIMIT 1
    `;
    const workDays: number[] = scheduleRows[0]?.workDays
      ? JSON.parse(scheduleRows[0].workDays as unknown as string)
      : [0, 1, 2, 3, 4];

    // جلب العطل الرسمية في الفترة
    const holidays = await this.prisma.holiday.findMany({
      where: {
        OR: [
          { date: { gte: start, lte: end } },
          { AND: [{ date: { lte: end } }, { endDate: { gte: start } }] },
        ],
      },
    });
    const holidayDates = new Set<string>();
    for (const h of holidays) {
      const d = new Date(h.date);
      d.setHours(0, 0, 0, 0);
      const e = h.endDate ? new Date(h.endDate) : new Date(h.date);
      e.setHours(0, 0, 0, 0);
      while (d <= e) {
        holidayDates.add(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }
    }

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dayOfWeek = cur.getDay();
      const dateStr = cur.toISOString().split('T')[0];
      if (workDays.includes(dayOfWeek) && !holidayDates.has(dateStr)) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    return count;
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
    isUnlimited?: boolean,
  ) {
    const client = tx ?? this.prisma;
    const balance = await client.leaveBalance.findFirst({
      where: { employeeId, leaveTypeId, year },
      select: { id: true, totalDays: true, carriedOverDays: true },
    });

    if (!balance) {
      if (isUnlimited) return;
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
    if (!isUnlimited && remaining < 0) {
      throw new BadRequestException('Insufficient leave balance');
    }

    return client.leaveBalance.update({
      where: { id: balance.id },
      data: { remainingDays: Math.max(0, remaining) },
    });
  }

  // === إجازة ساعية ===

  async createHourlyLeave(dto: CreateHourlyLeaveDto, employeeId: string) {
    if (!employeeId) {
      throw new BadRequestException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'لا يوجد سجل موظف مرتبط بحسابك',
      });
    }

    const [sh, sm] = dto.startTime.split(':').map(Number);
    const [eh, em] = dto.endTime.split(':').map(Number);
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

    if (durationMinutes <= 0) {
      throw new BadRequestException('endTime يجب أن يكون بعد startTime');
    }

    const durationHours = durationMinutes / 60;

    // جلب نوع الإجازة والتحقق من الأهلية
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType || !leaveType.isActive) {
      throw new BadRequestException('نوع الإجازة غير صالح أو غير نشط');
    }
    await this.validateMinServiceMonths(employeeId, leaveType);
    await this.validateMaxLifetimeUsage(employeeId, leaveType);
    const overLimitHours = await this.validateMaxHoursPerMonth(employeeId, leaveType, dto.date, durationHours);

    // جلب ساعات وردية الموظف من attendance schema
    const shiftRows = (await this.prisma.$queryRawUnsafe(
      `SELECT ws."workStartTime", ws."workEndTime"
       FROM attendance.employee_schedules es
       JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
       WHERE es."employeeId" = $1 AND es."isActive" = true
       ORDER BY es."effectiveFrom" DESC LIMIT 1`,
      employeeId,
    )) as Array<{ workStartTime: string; workEndTime: string }>;

    let shiftHours = 8; // افتراضي
    if (shiftRows[0]?.workStartTime && shiftRows[0]?.workEndTime) {
      const [wsh, wsm] = shiftRows[0].workStartTime.split(':').map(Number);
      const [weh, wem] = shiftRows[0].workEndTime.split(':').map(Number);
      const computed = ((weh * 60 + wem) - (wsh * 60 + wsm)) / 60;
      if (computed > 0) shiftHours = computed;
    }

    const equivalentDays = durationHours / shiftHours;
    const year = new Date(dto.date).getFullYear();

    // التحقق من الرصيد
    const balance = await this.prisma.leaveBalance.findFirst({
      where: { employeeId, leaveTypeId: dto.leaveTypeId, year },
    });

    if (!balance && !leaveType.isUnlimited) {
      throw new BadRequestException('لا يوجد رصيد إجازة لهذا النوع');
    }

    if (balance && !leaveType.isUnlimited) {
      const pendingHours = (balance as any).pendingHours ?? 0;
      const usedHours = (balance as any).usedHours ?? 0;
      const remainingDays = (balance.totalDays + (balance.carriedOverDays ?? 0))
        - balance.usedDays
        - balance.pendingDays
        - (usedHours / shiftHours)
        - (pendingHours / shiftHours);

      if (equivalentDays > remainingDays) {
        throw new BadRequestException(
          `رصيد الإجازة غير كافٍ. المتاح: ${remainingDays.toFixed(2)} يوم`,
        );
      }
    }

    const dmIsHR = leaveType.requiresApproval
      ? await this.isEmployeeDMAlsoHR(employeeId)
      : false;
    const newStatus = dmIsHR ? 'PENDING_HR' : 'PENDING_MANAGER';

    // إنشاء الطلب في transaction
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await (tx as any).leaveRequest.create({
        data: {
          employeeId,
          leaveTypeId: dto.leaveTypeId,
          startDate: new Date(dto.date),
          endDate: new Date(dto.date),
          totalDays: equivalentDays,
          reason: dto.reason,
          isHourlyLeave: true,
          startTime: dto.startTime,
          endTime: dto.endTime,
          durationHours,
          equivalentDays,
          status: newStatus as any,
          managerStatus: dmIsHR ? null : 'PENDING',
          hrStatus: dmIsHR ? 'PENDING' : undefined,
          ...(overLimitHours > 0 && {
            deductionInfo: {
              overLimitHours,
              paidHours: durationHours - overLimitHours,
              monthlyLimit: leaveType.maxHoursPerMonth,
              reason: 'تجاوز الحد الشهري للإجازات الساعية المدفوعة',
            },
          }),
        },
      });

      // تحديث الأرصدة (إن وُجدت)
      if (balance) {
        await (tx as any).leaveBalance.update({
          where: { id: balance.id },
          data: {
            pendingDays: { increment: equivalentDays },
            pendingHours: { increment: durationHours },
            remainingDays: leaveType.isUnlimited ? undefined : { decrement: equivalentDays },
          },
        });
      }

      return created;
    });

    await this.addHistory(request.id, 'SUBMIT', null, newStatus, employeeId,
      dmIsHR ? 'إجازة ساعية مقدّمة — المدير المباشر هو HR' : 'إجازة ساعية مقدّمة');
    await this.notifyLeaveEmployee(
      employeeId, 'LEAVE_REQUEST_SUBMITTED',
      'تم تقديم طلب إجازتك', 'Leave Request Submitted',
      'تم تقديم طلب إجازتك بنجاح وهو الآن في انتظار المراجعة',
      'Your leave request has been submitted and is awaiting review',
      request.id,
    );
    if (dmIsHR) {
      await this.notifyHROfLeave(request.id, leaveType.nameAr ?? 'إجازة');
    } else {
      await this.notifyManagerOfLeave(employeeId, request.id, leaveType.nameAr ?? 'إجازة');
    }
    return request;
  }

  // إنشاء طلب إجازة (مسودة)
  async create(createDto: CreateLeaveRequestDto, employeeId: string) {
    if (!employeeId) {
      throw new BadRequestException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'لا يوجد سجل موظف مرتبط بحسابك',
      });
    }

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

    // التحقق من شروط الأهلية
    await this.validateMinServiceMonths(employeeId, leaveType);
    await this.validateMaxLifetimeUsage(employeeId, leaveType);

    // حساب عدد الأيام
    const totalDays = await this.calculateLeaveDays(new Date(startDate), new Date(endDate), isHalfDay, employeeId);

    // التحقق من الحد الأقصى للإجازة المرضية
    await this.validateSickLeaveLimit(employeeId, leaveType, totalDays);

    // التحقق من الحد الأقصى للأيام
    if (leaveType.maxDaysPerRequest && totalDays > leaveType.maxDaysPerRequest) {
      throw new BadRequestException(
        `Maximum ${leaveType.maxDaysPerRequest} days allowed per request`,
      );
    }

    // ── التحقق من نافذة التقديم ──────────────────────────────────────────
    {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      //양수 = مستقبل (مسبق)، سالب = ماضٍ (استرجاعي)
      const daysFromToday = Math.ceil((start.getTime() - today.getTime()) / 86400000);

      // قاعدة 1: كل إجازة > 4 أيام → 7 أيام إشعار مسبق (بدون استثناء ماعدا الطوارئ)
      const LONG_LEAVE_MIN = 7;
      // UNPAID مستثناة: تُقدَّم بأي وقت (حتى نفس اليوم) بدون إشعار مسبق
      const LONG_LEAVE_EXEMPT = ['SICK', 'EMERGENCY', 'BEREAVEMENT', 'BIRTH', 'PATERNITY', 'UNPAID'];
      if (totalDays > 4 && !LONG_LEAVE_EXEMPT.includes(leaveType.code)) {
        if (daysFromToday < LONG_LEAVE_MIN) {
          throw new BadRequestException(
            `الإجازات التي تتجاوز 4 أيام يجب تقديمها قبل ${LONG_LEAVE_MIN} أيام على الأقل`,
          );
        }
      } else {
        // قاعدة 2: نافذة التقديم الخاصة بكل نوع (للإجازات ≤ 4 أيام)
        const TYPE_WINDOWS: Record<string, { maxRetroactive: number; maxAdvance?: number }> = {
          ANNUAL:       { maxRetroactive: 7, maxAdvance: 7 },
          HOURLY:       { maxRetroactive: 7, maxAdvance: 7 },
          UNPAID_DAILY: { maxRetroactive: 7, maxAdvance: 7 },
          SICK:         { maxRetroactive: 7, maxAdvance: 1 },
          // UNPAID: بأي وقت — لا حد للتقديم المسبق ولا المتأخر
          UNPAID:       { maxRetroactive: 3650 },
        };
        const win = TYPE_WINDOWS[leaveType.code];
        if (win) {
          if (daysFromToday < -win.maxRetroactive) {
            throw new BadRequestException(
              `لا يمكن تقديم هذا الطلب — تجاوزت مهلة التقديم (${win.maxRetroactive} يوم بعد بدء الإجازة)`,
            );
          }
          if (win.maxAdvance !== undefined && daysFromToday > win.maxAdvance) {
            throw new BadRequestException(
              `لا يمكن تقديم هذا الطلب مبكراً — الحد الأقصى للتقديم المسبق ${win.maxAdvance} يوم`,
            );
          }
        } else if (leaveType.minDaysNotice && leaveType.minDaysNotice > 0) {
          // قاعدة 3: أنواع أخرى → استخدم minDaysNotice من الإعداد (MARRIAGE, HAJJ...)
          if (daysFromToday < leaveType.minDaysNotice) {
            throw new BadRequestException(
              `يجب تقديم الطلب قبل ${leaveType.minDaysNotice} يوم على الأقل`,
            );
          }
        }
      }
    }

    // التحقق من المرفق المطلوب (إجباري فقط إذا الإجازة يومين أو أكثر)
    if (leaveType.requiresAttachment && !createDto.attachmentUrl && totalDays >= 2) {
      throw new BadRequestException('هذا النوع من الإجازات يتطلب إرفاق مستند عند طلب يومين أو أكثر');
    }

    // التحقق من السماح بنصف يوم
    if (isHalfDay && !leaveType.allowHalfDay) {
      throw new BadRequestException('هذا النوع من الإجازات لا يسمح بطلب نصف يوم');
    }

    // التحقق من درجة القرابة لإجازة الوفاة
    if (leaveType.code === 'BEREAVEMENT' && !createDto.deceasedRelation) {
      throw new BadRequestException({
        code: 'DECEASED_RELATION_REQUIRED',
        message: 'يجب تحديد درجة القرابة للمتوفى (أولى أو ثانية)',
      });
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
      totalDays = await this.calculateLeaveDays(start, end, isHalf, employeeId);
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

    const isUnlimited = (request as any).leaveType?.isUnlimited ?? false;
    if (balance && !isUnlimited && balance.remainingDays < request.totalDays) {
      throw new BadRequestException('Insufficient leave balance');
    }

    const hasSubstitute = !!request.substituteId;
    const requiresApproval = (request as any).leaveType?.requiresApproval ?? true;

    // DM==HR dedup عند التقديم: لو المدير نفسه HR → تخطي PENDING_MANAGER وروح لـ PENDING_HR مباشرة
    const dmIsHR = !hasSubstitute && requiresApproval
      ? await this.isEmployeeDMAlsoHR(employeeId)
      : false;

    const newStatus = hasSubstitute
      ? 'PENDING_SUBSTITUTE'
      : dmIsHR ? 'PENDING_HR' : 'PENDING_MANAGER';

    // تحديث الحالة وحجز الأيام (داخل transaction لمنع race condition)
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: newStatus as any,
          managerStatus: hasSubstitute ? null : (dmIsHR ? null : 'PENDING'),
          substituteStatus: hasSubstitute ? 'PENDING' : null,
          hrStatus: dmIsHR ? 'PENDING' : undefined,
        },
        include: { leaveType: true },
      });
      if (balance) {
        await this.updateLeaveBalance(employeeId, request.leaveTypeId, year, 0, request.totalDays, tx, isUnlimited);
      }
      return result;
    });

    await this.addHistory(id, 'SUBMIT', 'DRAFT', newStatus, employeeId,
      hasSubstitute
        ? 'Request submitted — awaiting substitute approval'
        : dmIsHR
          ? 'Request submitted — DM is HR, going directly to HR approval'
          : 'Request submitted for manager approval',
    );

    await this.notifyLeaveEmployee(employeeId, 'LEAVE_REQUEST_SUBMITTED',
      'تم تقديم طلب إجازتك', 'Leave Request Submitted',
      'تم تقديم طلب إجازتك بنجاح وهو الآن في انتظار المراجعة',
      'Your leave request has been submitted and is awaiting review',
      id,
    );

    if (!hasSubstitute) {
      if (dmIsHR) {
        await this.notifyHROfLeave(id, (request as any).leaveType?.nameAr ?? 'إجازة');
      } else {
        await this.notifyManagerOfLeave(employeeId, id, (request as any).leaveType?.nameAr ?? 'إجازة');
      }
    }

    return updated;
  }

  async findPendingSubstitute(employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { substituteId: employeeId, status: 'PENDING_SUBSTITUTE' as any },
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' },
    });
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

    // DM==HR dedup: لو المدير نفسه HR → تخطي PENDING_HR والاعتماد مباشرة
    const dmIsHR = request.leaveType.requiresApproval ? await this.isManagerAlsoHR(managerId) : false;
    const newStatus = request.leaveType.requiresApproval && !dmIsHR ? 'PENDING_HR' : 'APPROVED';

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: newStatus,
          managerStatus: 'APPROVED',
          managerApprovedBy: managerId,
          managerApprovedAt: new Date(),
          managerNotes: dto.notes,
          hrStatus: request.leaveType.requiresApproval && !dmIsHR ? 'PENDING_HR' : undefined,
        },
        include: { leaveType: true },
      });
      if (newStatus === 'APPROVED') {
        const year = new Date(request.startDate).getFullYear();
        await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, request.totalDays, -request.totalDays, tx, request.leaveType.isUnlimited);
      }
      return result;
    });

    await this.addHistory(id, 'MANAGER_APPROVE', 'PENDING_MANAGER', newStatus, managerId, dto.notes || 'Approved by manager');

    if (newStatus === 'PENDING_HR') {
      await this.notifyHROfLeave(id, request.leaveType.nameAr ?? 'إجازة');
    }

    if (newStatus === 'APPROVED') {
      await this.notifyLeaveEmployee(request.employeeId, 'LEAVE_REQUEST_APPROVED',
        'تمت الموافقة على طلب إجازتك', 'Leave Request Approved',
        'تمت الموافقة على طلب إجازتك من قِبل المدير المباشر',
        'Your leave request has been approved by your manager',
        id,
      );
    }

    if (newStatus === 'APPROVED') {
      await this.applySickLeaveDeduction(id, request.leaveType, request.employeeId, request.totalDays);
      if ((request as any).isHourlyLeave) {
        await this.applyHourlyLeaveToBalance(request);
        await this.createPartialLeaveAttendanceRecord(request);
      } else {
        await this.createOnLeaveAttendanceRecords(
          request.employeeId, request.startDate, request.endDate,
          (request as any).isHalfDay, (request as any).halfDayPeriod,
        );
      }
    }

    return updated;
  }

  // رفض المدير
  async rejectByManager(id: string, dto: RejectLeaveRequestDto, managerId: string) {
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
      await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, 0, -request.totalDays, tx, (request as any).leaveType?.isUnlimited);
      return result;
    });

    await this.addHistory(id, 'MANAGER_REJECT', 'PENDING_MANAGER', 'REJECTED', managerId, dto.notes);

    await this.notifyLeaveEmployee(request.employeeId, 'LEAVE_REQUEST_REJECTED',
      'تم رفض طلب إجازتك', 'Leave Request Rejected',
      'تم رفض طلب إجازتك من قِبل المدير المباشر',
      'Your leave request has been rejected by your manager',
      id,
    );

    return updated;
  }

  // موافقة HR
  async approveByHR(id: string, dto: ApproveLeaveRequestDto, hrUserId: string) {
    const isCEO = await this.isUserCEO(hrUserId);
    if (isCEO) throw new ForbiddenException('المدير التنفيذي لا يمكنه الموافقة على طلبات بصفة HR');

    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { leaveType: true },
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
      await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, request.totalDays, -request.totalDays, tx, (request as any).leaveType?.isUnlimited);
      return result;
    });

    await this.addHistory(id, 'HR_APPROVE', 'PENDING_HR', 'APPROVED', hrUserId, dto.notes || 'Approved by HR');

    await this.notifyLeaveEmployee(request.employeeId, 'LEAVE_REQUEST_APPROVED',
      'تمت الموافقة على طلب إجازتك', 'Leave Request Approved',
      'تمت الموافقة على طلب إجازتك من قِبل الموارد البشرية',
      'Your leave request has been approved by HR',
      id,
    );

    await this.applySickLeaveDeduction(id, (updated as any).leaveType, request.employeeId, request.totalDays);

    if ((request as any).isHourlyLeave) {
      await this.applyHourlyLeaveToBalance(request);
      await this.createPartialLeaveAttendanceRecord(request);
    } else {
      await this.createOnLeaveAttendanceRecords(
        request.employeeId, request.startDate, request.endDate,
        (request as any).isHalfDay, (request as any).halfDayPeriod,
      );
    }

    return updated;
  }

  // رفض HR
  async rejectByHR(id: string, dto: RejectLeaveRequestDto, hrUserId: string) {
    const isCEO = await this.isUserCEO(hrUserId);
    if (isCEO) throw new ForbiddenException('المدير التنفيذي لا يمكنه رفض طلبات بصفة HR');

    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { leaveType: true },
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
      await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, 0, -request.totalDays, tx, (request as any).leaveType?.isUnlimited);
      return result;
    });

    await this.addHistory(id, 'HR_REJECT', 'PENDING_HR', 'REJECTED', hrUserId, dto.notes);

    await this.notifyLeaveEmployee(request.employeeId, 'LEAVE_REQUEST_REJECTED',
      'تم رفض طلب إجازتك', 'Leave Request Rejected',
      'تم رفض طلب إجازتك من قِبل الموارد البشرية',
      'Your leave request has been rejected by HR',
      id,
    );

    return updated;
  }

  // إلغاء الطلب
  private async isEmployeeDMAlsoHR(employeeId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string | null }>>(
      `SELECT e2."userId" FROM users.employees e
       JOIN users.employees e2 ON e2.id = e."managerId"
       WHERE e.id = $1 AND e."deletedAt" IS NULL LIMIT 1`,
      employeeId,
    );
    const managerUserId = rows[0]?.userId;
    if (!managerUserId) return false;
    return this.isManagerAlsoHR(managerUserId);
  }

  private async isManagerAlsoHR(managerUserId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM users.user_roles ur
       JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
       JOIN users.permissions p ON p.id = rp."permissionId"
       WHERE ur."userId" = $1 AND p.name = 'leave_requests:approve_hr'`,
      managerUserId,
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async isUserCEO(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM users.user_roles ur
       JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
       JOIN users.permissions p ON p.id = rp."permissionId"
       WHERE ur."userId" = $1 AND p.name = 'requests:ceo-approve'`,
      userId,
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async notifyManagerOfLeave(employeeId: string, leaveRequestId: string, leaveTypeName: string) {
    try {
      const mgr = await this.prisma.$queryRawUnsafe<Array<{ userId: string | null }>>(
        `SELECT e2."userId" FROM users.employees e
         JOIN users.employees e2 ON e2.id = e."managerId"
         WHERE e.id = $1 AND e."deletedAt" IS NULL LIMIT 1`,
        employeeId,
      );
      if (!mgr[0]?.userId) return;
      await this.prisma.$queryRawUnsafe(`
        INSERT INTO users.notifications
          (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
        VALUES (gen_random_uuid(), $1, $2::users."NotificationType", $3, $4, $5, $6, $7::jsonb, false, NOW())
      `, mgr[0].userId, 'LEAVE_REQUEST_SUBMITTED',
         `طلب إجازة بانتظار موافقتك`,
         'Leave Request Awaiting Your Approval',
         `تم تقديم طلب إجازة (${leaveTypeName}) وهو بانتظار موافقتك`,
         `A leave request (${leaveTypeName}) is awaiting your approval`,
         JSON.stringify({ leaveRequestId }));
    } catch { /* silent */ }
  }

  private async notifyHROfLeave(leaveRequestId: string, leaveTypeName: string) {
    try {
      const hrUsers = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT DISTINCT u.id as "userId" FROM users.users u
         JOIN users.user_roles ur ON ur."userId" = u.id
         JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
         JOIN users.permissions p ON p.id = rp."permissionId"
         WHERE p.name = 'leave_requests:approve_hr' AND u."deletedAt" IS NULL
         AND u.id NOT IN (
           SELECT DISTINCT ur2."userId" FROM users.user_roles ur2
           JOIN users.role_permissions rp2 ON rp2."roleId" = ur2."roleId"
           JOIN users.permissions p2 ON p2.id = rp2."permissionId"
           WHERE p2.name = 'requests:ceo-approve'
         )`,
      );
      for (const hr of hrUsers) {
        await this.prisma.$queryRawUnsafe(`
          INSERT INTO users.notifications
            (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
          VALUES (gen_random_uuid(), $1, $2::users."NotificationType", $3, $4, $5, $6, $7::jsonb, false, NOW())
        `, hr.userId, 'LEAVE_REQUEST_SUBMITTED',
           `طلب إجازة بانتظار موافقة HR`,
           'Leave Request Awaiting HR Approval',
           `اعتمد المدير المباشر طلب إجازة (${leaveTypeName}) وهو بانتظار موافقتك`,
           `A leave request (${leaveTypeName}) was approved by the manager and awaits your approval`,
           JSON.stringify({ leaveRequestId }));
      }
    } catch { /* silent */ }
  }

  private async notifyManagerOfApprovedCancellation(employeeId: string, leaveRequestId: string, leaveTypeName: string) {
    try {
      const mgr = await this.prisma.$queryRawUnsafe<Array<{ userId: string | null }>>(
        `SELECT e2."userId" FROM users.employees e
         JOIN users.employees e2 ON e2.id = e."managerId"
         WHERE e.id = $1 AND e."deletedAt" IS NULL LIMIT 1`,
        employeeId,
      );
      if (!mgr[0]?.userId) return;
      const empName = await this.prisma.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT "fullName" as name FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
        employeeId,
      );
      const name = empName[0]?.name ?? 'الموظف';
      await this.prisma.$queryRawUnsafe(`
        INSERT INTO users.notifications
          (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
        VALUES (gen_random_uuid(), $1, $2::users."NotificationType", $3, $4, $5, $6, $7::jsonb, false, NOW())
      `, mgr[0].userId, 'LEAVE_REQUEST_CANCELLED',
         `إلغاء إجازة معتمدة`,
         'Approved Leave Cancelled',
         `قام ${name} بإلغاء إجازته المعتمدة (${leaveTypeName})`,
         `${name} has cancelled their approved leave (${leaveTypeName})`,
         JSON.stringify({ leaveRequestId }));
    } catch { /* silent */ }
  }

  private async notifyHROfApprovedCancellation(leaveRequestId: string, leaveTypeName: string) {
    try {
      const hrUsers = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT DISTINCT u.id as "userId" FROM users.users u
         JOIN users.user_roles ur ON ur."userId" = u.id
         JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
         JOIN users.permissions p ON p.id = rp."permissionId"
         WHERE p.name = 'leave_requests:approve_hr' AND u."deletedAt" IS NULL
         AND u.id NOT IN (
           SELECT DISTINCT ur2."userId" FROM users.user_roles ur2
           JOIN users.role_permissions rp2 ON rp2."roleId" = ur2."roleId"
           JOIN users.permissions p2 ON p2.id = rp2."permissionId"
           WHERE p2.name = 'requests:ceo-approve'
         )`,
      );
      for (const hr of hrUsers) {
        await this.prisma.$queryRawUnsafe(`
          INSERT INTO users.notifications
            (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
          VALUES (gen_random_uuid(), $1, $2::users."NotificationType", $3, $4, $5, $6, $7::jsonb, false, NOW())
        `, hr.userId, 'LEAVE_REQUEST_CANCELLED',
           `إلغاء إجازة معتمدة`,
           'Approved Leave Cancelled',
           `تم إلغاء إجازة معتمدة (${leaveTypeName}) من قِبل الموظف`,
           `An approved leave (${leaveTypeName}) has been cancelled by the employee`,
           JSON.stringify({ leaveRequestId }));
      }
    } catch { /* silent */ }
  }

  private async notifyLeaveEmployee(
    employeeId: string,
    type: string,
    titleAr: string,
    titleEn: string,
    messageAr: string,
    messageEn: string,
    leaveRequestId: string,
  ) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT "userId" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
        employeeId,
      );
      const userId = rows[0]?.userId;
      if (!userId) return;
      await this.prisma.$queryRawUnsafe(`
        INSERT INTO users.notifications
          (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
        VALUES
          (gen_random_uuid(), $1, $2::users."NotificationType", $3, $4, $5, $6, $7::jsonb, false, NOW())
      `, userId, type, titleAr, titleEn, messageAr, messageEn,
         JSON.stringify({ leaveRequestId }));
    } catch { /* silent — notification is non-critical */ }
  }

  async cancel(id: string, dto: CancelLeaveRequestDto, userId: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { leaveType: true },
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

    // الإجازات المعتمدة لا يمكن إلغاؤها في نفس يوم الإجازة أو بعده — يجب الإلغاء قبل يوم على الأقل
    if (request.status === 'APPROVED') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const leaveStart = new Date(request.startDate);
      leaveStart.setHours(0, 0, 0, 0);
      if (today >= leaveStart) {
        throw new BadRequestException(
          'لا يمكن إلغاء إجازة معتمدة في يوم الإجازة أو بعده — يجب الإلغاء قبل يوم على الأقل من تاريخ الإجازة',
        );
      }
    }

    const oldStatus = request.status;
    const year = new Date(request.startDate).getFullYear();
    const leaveTypeName = (request as any).leaveType?.nameAr ?? 'إجازة';

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
      const cancelIsUnlimited = (request as any).leaveType?.isUnlimited;
      if (oldStatus === 'APPROVED') {
        await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, -request.totalDays, 0, tx, cancelIsUnlimited);
      } else if (oldStatus === 'PENDING_MANAGER' || oldStatus === 'PENDING_HR') {
        await this.updateLeaveBalance(request.employeeId, request.leaveTypeId, year, 0, -request.totalDays, tx, cancelIsUnlimited);
      }
      return result;
    });

    await this.addHistory(id, 'CANCEL', oldStatus, 'CANCELLED', userId, dto.cancelReason);

    await this.notifyLeaveEmployee(request.employeeId, 'LEAVE_REQUEST_CANCELLED',
      'تم إلغاء طلب الإجازة', 'Leave Request Cancelled',
      'تم إلغاء طلب إجازتك بنجاح',
      'Your leave request has been cancelled',
      id,
    );

    // إذا كانت الإجازة معتمدة → أشعر المدير المباشر والـ HR بالإلغاء
    if (oldStatus === 'APPROVED') {
      await this.notifyManagerOfApprovedCancellation(request.employeeId, id, leaveTypeName);
      await this.notifyHROfApprovedCancellation(id, leaveTypeName);
    }

    return updated;
  }

  // === دوال التحقق من الأهلية والخصم ===

  private async getTotalApprovedDays(
    employeeId: string,
    leaveTypeId: string,
    excludeRequestId?: string,
  ): Promise<number> {
    if (excludeRequestId) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COALESCE(SUM("totalDays"), 0)::float as total
         FROM leaves.leave_requests
         WHERE "employeeId" = $1 AND "leaveTypeId" = $2 AND status = 'APPROVED' AND id != $3`,
        employeeId,
        leaveTypeId,
        excludeRequestId,
      );
      return Number(rows[0]?.total ?? 0);
    }
    const rows = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COALESCE(SUM("totalDays"), 0)::float as total
       FROM leaves.leave_requests
       WHERE "employeeId" = $1 AND "leaveTypeId" = $2 AND status = 'APPROVED'`,
      employeeId,
      leaveTypeId,
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async validateMinServiceMonths(employeeId: string, leaveType: any): Promise<void> {
    if (!leaveType.minServiceMonths) return;

    const empRows = await this.prisma.$queryRawUnsafe<Array<{ hireDate: Date | null }>>(
      `SELECT "hireDate" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      employeeId,
    );
    const hireDate = empRows[0]?.hireDate;
    if (!hireDate) return;

    const now = new Date();
    const hire = new Date(hireDate);
    const months =
      (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());

    if (months < leaveType.minServiceMonths) {
      throw new BadRequestException(
        `يجب أن تكمل ${leaveType.minServiceMonths} شهراً على الأقل للتأهل لطلب ${leaveType.nameAr}`,
      );
    }
  }

  private async validateMaxLifetimeUsage(employeeId: string, leaveType: any): Promise<void> {
    if (!leaveType.maxLifetimeUsage) return;

    const count = await this.prisma.leaveRequest.count({
      where: { employeeId, leaveTypeId: leaveType.id, status: 'APPROVED' },
    });

    if (count >= leaveType.maxLifetimeUsage) {
      throw new BadRequestException(
        `يحق لك أخذ ${leaveType.nameAr} مرة واحدة فقط خلال فترة توظيفك`,
      );
    }
  }

  // يرجع عدد الساعات التي تتجاوز الحد المدفوع (0 إذا كان كل شيء ضمن الحد)
  private async validateMaxHoursPerMonth(
    employeeId: string,
    leaveType: any,
    date: string,
    requestedHours: number,
  ): Promise<number> {
    if (!leaveType.maxHoursPerMonth) return 0;

    const rows = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COALESCE(SUM("durationHours"), 0)::float as total
       FROM leaves.leave_requests
       WHERE "employeeId" = $1
         AND "leaveTypeId" = $2
         AND "isHourlyLeave" = true
         AND status IN ('APPROVED', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUBSTITUTE')
         AND EXTRACT(MONTH FROM "startDate") = EXTRACT(MONTH FROM $3::date)
         AND EXTRACT(YEAR  FROM "startDate") = EXTRACT(YEAR  FROM $3::date)`,
      employeeId,
      leaveType.id,
      date,
    );

    const usedHours = Number(rows[0]?.total ?? 0);
    const paidLimit = leaveType.maxHoursPerMonth;

    if (usedHours >= paidLimit) {
      return requestedHours; // كل الساعات المطلوبة خارج الحد المدفوع
    }
    if (usedHours + requestedHours > paidLimit) {
      return (usedHours + requestedHours) - paidLimit; // جزء منها خارج الحد
    }
    return 0; // كل الساعات ضمن الحد المدفوع
  }

  private async validateSickLeaveLimit(
    employeeId: string,
    leaveType: any,
    requestedDays: number,
  ): Promise<void> {
    if (leaveType.code !== 'SICK') return;

    const maxDays = leaveType.defaultDays ?? 180;
    const usedDays = await this.getTotalApprovedDays(employeeId, leaveType.id);

    if (usedDays >= maxDays) {
      throw new BadRequestException(
        `لقد استنفدت الحد الأقصى للإجازة المرضية (${maxDays} يوماً). يمكنك طلب إجازة بدون راتب`,
      );
    }

    if (usedDays + requestedDays > maxDays) {
      throw new BadRequestException(
        `الأيام المطلوبة تتجاوز الحد الأقصى للإجازة المرضية. المتاح: ${maxDays - usedDays} يوم فقط`,
      );
    }
  }

  private calculateSickDeduction(
    rules: Array<{ fromDay: number; toDay: number; deductionPercent: number }>,
    alreadyUsedDays: number,
    requestDays: number,
  ): Array<{ fromDay: number; toDay: number; days: number; deductionPercent: number }> | null {
    const segments: Array<{ fromDay: number; toDay: number; days: number; deductionPercent: number }> = [];
    const reqStart = alreadyUsedDays + 1;
    const reqEnd = alreadyUsedDays + requestDays;

    for (const rule of rules) {
      const overlapStart = Math.max(reqStart, rule.fromDay);
      const overlapEnd = Math.min(reqEnd, rule.toDay);
      if (overlapStart <= overlapEnd) {
        segments.push({
          fromDay: overlapStart,
          toDay: overlapEnd,
          days: overlapEnd - overlapStart + 1,
          deductionPercent: rule.deductionPercent,
        });
      }
    }

    return segments.length > 0 ? segments : null;
  }

  private async applySickLeaveDeduction(
    requestId: string,
    leaveType: any,
    employeeId: string,
    requestDays: number,
  ): Promise<void> {
    try {
      if (!leaveType || leaveType.code !== 'SICK') return;
      const rules = leaveType.salaryDeductionRules;
      if (!rules || !Array.isArray(rules)) return;

      const alreadyUsed = await this.getTotalApprovedDays(employeeId, leaveType.id, requestId);
      const deduction = this.calculateSickDeduction(rules, alreadyUsed, requestDays);
      if (!deduction) return;

      await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: { deductionInfo: deduction as any },
      });
    } catch (err) {
      console.error('[applySickLeaveDeduction] failed:', (err as any)?.message);
    }
  }

  // إنشاء سجلات ON_LEAVE في جدول الحضور عند اعتماد الإجازة
  private async applyHourlyLeaveToBalance(request: any): Promise<void> {
    try {
      const year = new Date(request.startDate).getFullYear();
      const balance = await this.prisma.leaveBalance.findFirst({
        where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year },
      });
      if (!balance) return;

      const durationHours: number = request.durationHours ?? 0;
      const equivalentDays: number = request.equivalentDays ?? request.totalDays ?? 0;

      await (this.prisma.leaveBalance as any).update({
        where: { id: balance.id },
        data: {
          usedDays:     { increment: equivalentDays },
          usedHours:    { increment: durationHours },
          pendingDays:  { decrement: equivalentDays },
          pendingHours: { decrement: durationHours },
        },
      });
    } catch (err) {
      console.error('[applyHourlyLeaveToBalance] failed:', (err as any)?.message);
    }
  }

  private async createPartialLeaveAttendanceRecord(request: any): Promise<void> {
    try {
      const dateStr = new Date(request.startDate).toISOString().split('T')[0];
      const startTime: string = request.startTime ?? null;
      const endTime: string = request.endTime ?? null;
      const durationHours: number = request.durationHours ?? 0;
      const leaveStartTs = startTime ? new Date(`${dateStr}T${startTime}:00`) : null;
      const leaveEndTs = endTime ? new Date(`${dateStr}T${endTime}:00`) : null;
      const hourlyLeaveMinutes = Math.floor(durationHours * 60);

      await this.prisma.$queryRawUnsafe(
        `INSERT INTO attendance.attendance_records
           (id, "employeeId", date, status, source, "isManualEntry",
            "lateMinutes", "earlyLeaveMinutes", "deductionApplied",
            "hourlyLeaveMinutes", "leaveStartTime", "leaveEndTime",
            "salaryLinked", "createdAt", "updatedAt")
         VALUES
           (gen_random_uuid(), $1, $2::date, 'PARTIAL_LEAVE', 'SYSTEM', false,
            0, 0, false, $3, $4, $5, false, NOW(), NOW())
         ON CONFLICT ("employeeId", date) DO UPDATE SET
           status = CASE
             WHEN attendance_records."clockInTime" IS NOT NULL THEN 'PARTIAL_LEAVE'
             ELSE 'ON_LEAVE'
           END,
           "leaveStartTime"                    = EXCLUDED."leaveStartTime",
           "leaveEndTime"                      = EXCLUDED."leaveEndTime",
           "hourlyLeaveMinutes"                = EXCLUDED."hourlyLeaveMinutes",
           "tardinessPendingDeductionMinutes"  = 0,
           "earlyLeavePendingDeductionMinutes" = 0,
           "updatedAt"                         = NOW()`,
        request.employeeId, dateStr, hourlyLeaveMinutes, leaveStartTs, leaveEndTs,
      );
    } catch (err) {
      console.error('[createPartialLeaveAttendanceRecord] failed:', (err as any)?.message);
    }
  }

  private async createOnLeaveAttendanceRecords(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    isHalfDay?: boolean,
    halfDayPeriod?: string,
  ): Promise<void> {
    // نصف اليوم: حالة HALF_DAY مع halfDayPeriod — وإلا ON_LEAVE كاملاً
    const leaveStatus = isHalfDay && halfDayPeriod ? 'HALF_DAY' : 'ON_LEAVE';
    const halfDayValue = isHalfDay && halfDayPeriod ? halfDayPeriod : null;

    try {
      const current = new Date(startDate);
      current.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];

        // التحقق من وجود حضور فعلي قبل الكتابة فوقه
        const existingRecord = await this.prisma.$queryRawUnsafe<Array<{ id: string; clockInTime: Date | null }>>(
          `SELECT id, "clockInTime" FROM attendance.attendance_records WHERE "employeeId" = $1 AND date = $2::date LIMIT 1`,
          employeeId,
          dateStr,
        );

        if (existingRecord[0]?.clockInTime) {
          // يوجد حضور فعلي — نحدّث halfDayPeriod فقط إذا نصف يوم، وإلا ننشئ تنبيه
          if (halfDayValue) {
            await this.prisma.$queryRawUnsafe(
              `UPDATE attendance.attendance_records SET "halfDayPeriod" = $1, "updatedAt" = NOW()
               WHERE "employeeId" = $2 AND date = $3::date`,
              halfDayValue, employeeId, dateStr,
            );
          } else {
            await this.prisma.$queryRawUnsafe(
              `INSERT INTO attendance.attendance_alerts
                 (id, "employeeId", date, "alertType", severity, message, "messageAr", status, "isAutoGenerated", "createdAt", "updatedAt")
               VALUES
                 (gen_random_uuid(), $1, $2::date, 'LEAVE_ATTENDANCE_CONFLICT', 'HIGH', $3, $3, 'OPEN', true, NOW(), NOW())`,
              employeeId,
              dateStr,
              `تعارض: يوجد إجازة معتمدة ليوم ${dateStr} مع حضور فعلي مسجّل — يتطلب مراجعة يدوية`,
            );
          }
        } else {
          // لا يوجد حضور فعلي — آمن للكتابة
          await this.prisma.$queryRawUnsafe(
            `INSERT INTO attendance.attendance_records (id, "employeeId", date, status, "halfDayPeriod", source, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2::date, $3, $4, 'MANUAL', NOW(), NOW())
             ON CONFLICT ("employeeId", date) DO UPDATE
               SET status = $3, "halfDayPeriod" = $4, "updatedAt" = NOW()`,
            employeeId, dateStr, leaveStatus, halfDayValue,
          );
        }

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

    // الطلبات التي اعتمدها مدير معيّن (managerApprovedBy = userId المدير)
    if (filters?.approvedByManagerUserId) {
      where.managerApprovedBy = filters.approvedByManagerUserId;
      where.managerStatus = 'APPROVED';
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.startDate = {};
      if (filters.dateFrom) where.startDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.startDate.lte = new Date(filters.dateTo);
    }

    // Filter by manager's subordinates
    if (filters?.managerId) {
      const usersUrl = process.env.USERS_SERVICE_URL;
      const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
      if (usersUrl) {
        try {
          const res = await fetch(`${usersUrl}/api/v1/employees/internal/subordinate-ids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-token': internalToken ?? '' },
            body: JSON.stringify({ managerId: filters.managerId }),
          });
          const body = await res.json();
          const subordinateIds: string[] = Array.isArray(body) ? body : (body?.data ?? []);
          where.employeeId = { in: subordinateIds.length ? subordinateIds : ['__none__'] };
        } catch {}
      }
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

    // Enrich with employee names via direct DB query
    const employeeIds = [...new Set(items.map(i => i.employeeId))];
    let employeeMap: Record<string, { firstNameAr: string; lastNameAr: string; firstNameEn?: string; lastNameEn?: string }> = {};
    if (employeeIds.length) {
      try {
        const employees = await this.prisma.$queryRawUnsafe<Array<{
          id: string; firstNameAr: string; lastNameAr: string; firstNameEn: string | null; lastNameEn: string | null;
        }>>(
          `SELECT id, "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn"
           FROM users.employees
           WHERE id::text = ANY($1::text[])`,
          employeeIds,
        );
        for (const e of employees) employeeMap[e.id] = e;
      } catch {}
    }

    const enriched = items.map(item => ({
      ...item,
      employeeFirstNameAr: employeeMap[item.employeeId]?.firstNameAr ?? null,
      employeeLastNameAr: employeeMap[item.employeeId]?.lastNameAr ?? null,
      employeeFirstNameEn: employeeMap[item.employeeId]?.firstNameEn ?? null,
      employeeLastNameEn: employeeMap[item.employeeId]?.lastNameEn ?? null,
    }));

    return { items: enriched, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
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

  async checkOverlap(userId: string, from: Date, to: Date) {
    const overlapping = await this.prisma.$queryRawUnsafe<Array<{ id: string; leaveType: string }>>(
      `SELECT lr.id, lt.code as "leaveType"
       FROM leaves.leave_requests lr
       JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
       JOIN users.employees e ON e.id = lr."employeeId"
       WHERE e."userId" = $1
         AND lr.status::text IN ('APPROVED', 'HR_APPROVED', 'MANAGER_APPROVED')
         AND lr."deletedAt" IS NULL
         AND lr."startDate" <= $3
         AND lr."endDate" >= $2
       LIMIT 1`,
      userId, from, to,
    );
    return {
      hasOverlap: overlapping.length > 0,
      leaveType: overlapping[0]?.leaveType ?? null,
    };
  }
}
