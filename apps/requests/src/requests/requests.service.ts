import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests.query.dto';
import { ApprovalService } from './approval.service';
import { RequestNotificationsService } from './notifications.service';
import { validateRequestDetails } from './validators/request-details.validator';
import * as fs from 'fs';
import * as path from 'path';

const HIRING_PDF_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'hiring-contracts')
  : '/app/uploads/hiring-contracts';
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB

// أنواع الطلبات المخصصة للمدير/HR فقط — الموظف لا يمكنه إنشاؤها
const MANAGER_ONLY_REQUEST_TYPES = [
  'HIRING_REQUEST',
  'REWARD',
  'PENALTY_PROPOSAL',
  'OVERTIME_MANAGER',
  'BUSINESS_MISSION',
];

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalService: ApprovalService,
    private readonly notifications: RequestNotificationsService,
  ) {}

  private async hasPermission(userId: string, permission: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM users.user_roles ur
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      WHERE ur."userId" = ${userId} AND p.name = ${permission}
    `;
    return Number(result[0]?.count ?? 0) > 0;
  }

  // جلب بيانات الموظفين بـ bulk query عبر cross-schema
  private async fetchEmployeeNames(employeeIds: string[]): Promise<Map<string, {
    firstNameAr: string; lastNameAr: string;
    firstNameEn: string | null; lastNameEn: string | null;
    employeeNumber: string;
  }>> {
    if (employeeIds.length === 0) return new Map();
    const placeholders = employeeIds.map((_, i) => `$${i + 1}`).join(', ');
    const employees = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn", "employeeNumber"
       FROM users.employees
       WHERE id IN (${placeholders})
       AND "deletedAt" IS NULL`,
      ...employeeIds
    )) as Array<{ id: string; firstNameAr: string; lastNameAr: string; firstNameEn: string | null; lastNameEn: string | null; employeeNumber: string }>;
    return new Map(employees.map(e => [e.id, e]));
  }

  // تنفيذ الإجراء الفعلي بعد اعتماد الطلب
  // جلب employeeId من userId عبر cross-schema query
  private async getEmployeeIdByUserId(userId: string): Promise<string | null> {
    const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users.employees WHERE "userId" = ${userId} AND "deletedAt" IS NULL LIMIT 1
    `;
    return result[0]?.id ?? null;
  }

  // توليد رقم طلب تسلسلي
  private async generateRequestNumber(): Promise<string> {
    const last = await this.prisma.request.findFirst({
      where: { requestNumber: { startsWith: 'VTX-LRQ-' } },
      orderBy: { requestNumber: 'desc' },
      select: { requestNumber: true },
    });
    const lastNum = last ? parseInt(last.requestNumber.replace('VTX-LRQ-', ''), 10) : 0;
    return `VTX-LRQ-${String(lastNum + 1).padStart(6, '0')}`;
  }

  async create(dto: CreateRequestDto, userId: string, permissions: string[] = []) {
    const employeeId = await this.getEmployeeIdByUserId(userId);
    if (!employeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No employee record found for this user',
        details: [],
      });
    }

    if ((dto.type as any) === 'MAINTENANCE') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'طلب الصيانة له مسار مخصّص — استخدم /requests/maintenance',
        details: [{ field: 'type', value: dto.type }],
      });
    }

    if (MANAGER_ONLY_REQUEST_TYPES.includes(dto.type)) {
      const canCreate = permissions.includes('requests:hr-approve')
        || permissions.includes('requests:approve')
        || permissions.includes('requests:read-all-steps')
        || permissions.includes('requests:manager-approve')
        || permissions.includes('requests:ceo-approve')
        || permissions.includes('requests:qs-approve');
      if (!canCreate) {
        throw new ForbiddenException({
          code: 'AUTH_INSUFFICIENT_PERMISSIONS',
          message: 'ليس لديك صلاحية لإنشاء هذا النوع من الطلبات',
          details: [{ field: 'type', value: dto.type }],
        });
      }
    }

    // منع تكرار نفس الطلب خلال 5 دقائق (نقر مزدوج أو إعادة إرسال بسبب انقطاع الشبكة)
    const recentDuplicate = await this.prisma.request.findFirst({
      where: {
        employeeId,
        type: dto.type as any,
        deletedAt: null,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recentDuplicate) {
      throw new BadRequestException({
        code: 'DUPLICATE_REQUEST',
        message: 'تم تقديم طلب من نفس النوع قبل قليل — الرجاء الانتظار بضع دقائق قبل إعادة المحاولة',
        details: [],
      });
    }

    // Retry up to 5 times to handle concurrent request number collisions
    for (let attempt = 0; attempt < 5; attempt++) {
      const requestNumber = await this.generateRequestNumber();
      try {
        return await this.prisma.request.create({
          data: {
            requestNumber,
            employeeId,
            type: dto.type as any,
            notes: dto.notes,
            attachmentUrl: dto.attachmentUrl,
            details: dto.details ?? undefined,
          },
          include: { history: true },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('requestNumber')) {
          continue; // رقم مكرر → حاول مرة أخرى
        }
        throw err;
      }
    }
    throw new BadRequestException('فشل توليد رقم الطلب، يرجى المحاولة مرة أخرى');
  }

  async submit(id: string, userId: string) {
    const request = await this.findRequestOrFail(id);
    const employeeId = await this.getEmployeeIdByUserId(userId);

    if (request.employeeId !== employeeId) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'Not your request', details: [] });
    }
    if (request.status !== 'DRAFT') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Only DRAFT requests can be submitted', details: [] });
    }

    validateRequestDetails(request.type, request.details);

    // حفظ القيم المحسوبة تلقائياً (totalHours, totalDays) في DB
    await this.prisma.request.update({
      where: { id },
      data: { details: request.details as any },
    });


    // طلب التفويض: إذا قدّمه المدير التنفيذي → اعتماد فوري + إشعار الموظف المفوَّض إليه
    if (request.type === 'DELEGATION') {
      const isCeoSubmitter = await this.hasPermission(userId, 'requests:ceo-approve');
      if (isCeoSubmitter) {
        await this.prisma.request.update({ where: { id }, data: { status: 'APPROVED' } });
        await this.prisma.requestHistory.create({
          data: { requestId: id, action: 'SUBMITTED', fromStatus: 'DRAFT', toStatus: 'APPROVED', performedBy: employeeId! },
        });
        const delegateId = (request.details as any)?.delegateEmployeeId;
        if (delegateId) {
          await this.notifications.notifyDelegationApproved({ requestId: id, delegateEmployeeId: delegateId });
        }
        return this.prisma.request.findFirst({
          where: { id },
          include: { approvalSteps: { orderBy: { stepOrder: 'asc' } }, history: { orderBy: { createdAt: 'desc' }, take: 5 } },
        });
      }
    }

    // طلبات المكافأة/العقوبة: إذا قدّمها المدير التنفيذي → اعتماد فوري بدون خطوات
    if (['REWARD', 'PENALTY_PROPOSAL'].includes(request.type)) {
      const isCeoSubmitter = await this.hasPermission(userId, 'requests:ceo-approve');
      if (isCeoSubmitter) {
        await this.prisma.request.update({ where: { id }, data: { status: 'APPROVED' } });
        await this.prisma.requestHistory.create({
          data: { requestId: id, action: 'SUBMITTED', fromStatus: 'DRAFT', toStatus: 'APPROVED', performedBy: employeeId! },
        });
        await this.approvalService.executeApprovedRequest({ ...request, details: request.details });
        await this.notifications.notifyRewardPenalty({
          requestId: id,
          requestType: request.type as 'REWARD' | 'PENALTY_PROPOSAL',
          action: 'APPROVED',
          employeeId: employeeId!,
          details: request.details,
        });
        return this.prisma.request.findFirst({
          where: { id },
          include: { approvalSteps: { orderBy: { stepOrder: 'asc' } }, history: { orderBy: { createdAt: 'desc' }, take: 5 } },
        });
      }
    }

    // تحديد context المقدِّم لطلبات المكافأة/العقوبة (تخطي خطوات ذكي)
    const submitterCtx = ['REWARD', 'PENALTY_PROPOSAL'].includes(request.type)
      ? { userId, employeeId: employeeId! }
      : undefined;

    const initialized = await this.approvalService.initializeApprovalSteps(id, request.type, request.employeeId, submitterCtx);
    const toStatus = initialized ? 'IN_APPROVAL' : 'PENDING_MANAGER';

    if (!initialized) {
      await this.prisma.request.update({ where: { id }, data: { status: 'PENDING_MANAGER' } });
    }

    await this.prisma.requestHistory.create({
      data: { requestId: id, action: 'SUBMITTED', fromStatus: 'DRAFT', toStatus, performedBy: employeeId! },
    });

    // إشعار المدير المباشر لكل الطلبات العادية (غير REWARD/PENALTY/OVERTIME_EMPLOYEE)
    const notifyManagerTypes = ['RESIGNATION', 'TRANSFER', 'BUSINESS_MISSION', 'DELEGATION', 'HIRING_REQUEST', 'COMPLAINT', 'REMOTE_WORK', 'OVERTIME_MANAGER', 'WORK_ACCIDENT', 'OTHER'];
    if (initialized && notifyManagerTypes.includes(request.type)) {
      await this.notifications.notifyFirstApprover({
        requestId: id,
        requestType: request.type,
        employeeId: employeeId!,
      });
    }

    if (['REWARD', 'PENALTY_PROPOSAL'].includes(request.type)) {
      await this.notifications.notifyRewardPenalty({
        requestId: id,
        requestType: request.type as 'REWARD' | 'PENALTY_PROPOSAL',
        action: 'SUBMITTED',
        employeeId: employeeId!,
        details: request.details,
      });
      // إشعار المعتمد الأول بأن الطلب وصل إليه
      const firstStep = await this.prisma.approvalStep.findFirst({
        where: { requestId: id },
        orderBy: { stepOrder: 'asc' },
      });
      if (firstStep) {
        await this.notifications.notifyNextApproverRewardPenalty({
          requestId: id,
          requestType: request.type as 'REWARD' | 'PENALTY_PROPOSAL',
          nextRole: firstStep.approverRole,
          employeeId: employeeId!,
          details: request.details,
        });
      }
    }

    // إشعار أول معتمد عند تقديم طلب العمل الإضافي
    if (request.type === 'OVERTIME_EMPLOYEE' && initialized) {
      const firstOvertimeStep = await this.prisma.approvalStep.findFirst({
        where: { requestId: id },
        orderBy: { stepOrder: 'asc' },
      });
      if (firstOvertimeStep) {
        await this.notifications.notifyOvertimeTransition({
          requestId: id,
          employeeId: employeeId!,
          nextRole: firstOvertimeStep.approverRole,
          approved: true,
        });
      }
    }

    return this.prisma.request.findFirst({
      where: { id },
      include: {
        approvalSteps: { orderBy: { stepOrder: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  // ── نظام الموافقات الجديد ──────────────────────────────────────

  async approveStep(id: string, userId: string, dto: ApproveRequestDto) {
    return this.approvalService.approve(id, userId, dto);
  }

  async rejectStep(id: string, userId: string, dto: RejectRequestDto) {
    return this.approvalService.reject(id, userId, dto.notes);
  }

  async getApprovalSteps(id: string) {
    return this.approvalService.getApprovalSteps(id);
  }

  async getPendingMyApproval(userId: string, page: number, limit: number) {
    return this.approvalService.getPendingMyApproval(userId, page, limit);
  }

  // deprecated: redirected to ApprovalService to enforce canApprove checks
  async managerApprove(id: string, userId: string, dto: ApproveRequestDto) {
    return this.approvalService.approve(id, userId, dto);
  }

  async managerReject(id: string, userId: string, dto: RejectRequestDto) {
    return this.approvalService.reject(id, userId, dto.notes);
  }

  // deprecated: redirected to ApprovalService to enforce canApprove checks
  async hrApprove(id: string, userId: string, dto: ApproveRequestDto) {
    return this.approvalService.approve(id, userId, dto);
  }

  async hrReject(id: string, userId: string, dto: RejectRequestDto) {
    return this.approvalService.reject(id, userId, dto.notes);
  }

  async cancel(id: string, userId: string, dto: CancelRequestDto) {
    const request = await this.findRequestOrFail(id);
    const employeeId = await this.getEmployeeIdByUserId(userId);

    if (request.employeeId !== employeeId) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'Not your request', details: [] });
    }
    if (!['DRAFT', 'PENDING_MANAGER', 'IN_APPROVAL'].includes(request.status)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cannot cancel request at this stage', details: [] });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // أغلق خطوات الاعتماد المعلقة إذا كان الطلب في مسار الاعتماد
      if (request.status === 'IN_APPROVAL') {
        await tx.approvalStep.updateMany({
          where: { requestId: id, status: 'PENDING' },
          data: { status: 'REJECTED', notes: 'Auto-closed: request cancelled by employee' },
        });
      }

      const result = await tx.request.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelReason: dto.reason,
          cancelledAt: new Date(),
          cancelledBy: employeeId,
        },
      });

      await tx.requestHistory.create({
        data: { requestId: id, action: 'CANCELLED', fromStatus: request.status, toStatus: 'CANCELLED', performedBy: employeeId, notes: dto.reason },
      });

      return result;
    });

    return updated;
  }

  async list(query: ListRequestsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.employeeId) where.employeeId = query.employeeId;

    const [items, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          history: { orderBy: { createdAt: 'desc' }, take: 5 },
          approvalSteps: { orderBy: { stepOrder: 'asc' } },
        },
      }),
      this.prisma.request.count({ where }),
    ]);

    const employeeIds = [...new Set((items as any[]).map(r => r.employeeId as string))];
    const employeeMap = await this.fetchEmployeeNames(employeeIds);
    const itemsWithEmployee = (items as any[]).map(r => ({ ...r, employee: employeeMap.get(r.employeeId) ?? null }));

    return { items: itemsWithEmployee, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // كل الطلبات المعتمدة من المدير التنفيذي (لها خطوة موافقة بدور CEO وحالتها APPROVED)
  async findCeoApproved(query: ListRequestsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      approvalSteps: { some: { approverRole: 'CEO', status: 'APPROVED' } },
    };
    if (query.type) where.type = query.type;

    const [items, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          history: { orderBy: { createdAt: 'desc' }, take: 5 },
          approvalSteps: { orderBy: { stepOrder: 'asc' } },
        },
      }),
      this.prisma.request.count({ where }),
    ]);

    const employeeIds = [...new Set((items as any[]).map(r => r.employeeId as string))];
    const employeeMap = await this.fetchEmployeeNames(employeeIds);
    const itemsWithEmployee = (items as any[]).map(r => ({ ...r, employee: employeeMap.get(r.employeeId) ?? null }));

    return { items: itemsWithEmployee, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async myRequests(userId: string, query: ListRequestsQueryDto) {
    const employeeId = await this.getEmployeeIdByUserId(userId);
    if (!employeeId) return { items: [], page: 1, limit: 10, total: 0, totalPages: 1 };

    return this.list({ ...query, employeeId });
  }

  async findOneScoped(id: string, userId: string, permissions: string[]) {
    const request = await this.prisma.request.findFirst({
      where: { id, deletedAt: null },
      include: {
        history: { orderBy: { createdAt: 'desc' } },
        approvalSteps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (!request) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Request not found', details: [{ field: 'id', value: id }] });
    }

    const isHr = permissions.includes('requests:hr-approve') || permissions.includes('requests:read-all-steps');
    if (!isHr) {
      const employeeId = await this.getEmployeeIdByUserId(userId);
      const isOwner = request.employeeId === employeeId;
      const isReviewer = (request.approvalSteps as any[]).some(s => s.reviewedBy === employeeId);
      if (!isOwner && !isReviewer) {
        throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'Not authorized to view this request', details: [] });
      }
    }

    const employeeMap = await this.fetchEmployeeNames([request.employeeId]);
    return { ...request, employee: employeeMap.get(request.employeeId) ?? null };
  }

  async findOne(id: string) {
    const request = await this.prisma.request.findFirst({
      where: { id, deletedAt: null },
      include: {
        history: { orderBy: { createdAt: 'desc' } },
        approvalSteps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (!request) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Request not found', details: [{ field: 'id', value: id }] });
    }

    const employeeMap = await this.fetchEmployeeNames([request.employeeId]);
    return { ...request, employee: employeeMap.get(request.employeeId) ?? null };
  }

  async submitExitInterview(id: string, userId: string, exitInterviewData: Record<string, any>) {
    const request = await this.findRequestOrFail(id);
    const employeeId = await this.getEmployeeIdByUserId(userId);

    if (request.employeeId !== employeeId) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'Not your request', details: [] });
    }
    if (request.status !== 'PENDING_EXIT_INTERVIEW') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Request is not awaiting exit interview', details: [] });
    }
    if (request.type !== 'RESIGNATION') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Exit interview is only for RESIGNATION requests', details: [] });
    }

    // بعد مقابلة الخروج: تُضاف خطوة موافقة المدير التنفيذي (CEO) قبل الاعتماد النهائي
    const existingSteps = await this.prisma.approvalStep.findMany({ where: { requestId: id } });
    const nextStepOrder = existingSteps.length > 0 ? Math.max(...existingSteps.map(s => s.stepOrder)) + 1 : 1;

    const existingDetails = (request.details as any) ?? {};
    await this.prisma.$transaction([
      this.prisma.approvalStep.create({
        data: {
          requestId: id,
          stepOrder: nextStepOrder,
          approverRole: 'CEO',
          status: 'PENDING',
        },
      }),
      this.prisma.request.update({
        where: { id },
        data: {
          status: 'IN_APPROVAL' as any,
          currentStepOrder: nextStepOrder,
          details: { ...existingDetails, exitInterview: exitInterviewData },
        },
      }),
    ]);

    await this.prisma.requestHistory.create({
      data: {
        requestId: id,
        action: 'EXIT_INTERVIEW_SUBMITTED',
        fromStatus: 'PENDING_EXIT_INTERVIEW',
        toStatus: 'IN_APPROVAL',
        performedBy: employeeId!,
        notes: 'Employee submitted exit interview form, pending CEO approval',
      },
    });

    await this.notifications.notifyCeoExitInterviewDone({ requestId: id, employeeId: request.employeeId });

    return this.prisma.request.findFirst({
      where: { id },
      include: {
        approvalSteps: { orderBy: { stepOrder: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  // B.7: Upload hiring contract PDF
  async uploadHiringPdf(id: string, file: Express.Multer.File, userId: string) {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException({ code: 'EMPTY_FILE', message: 'File is empty or was not received', details: [] });
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'File exceeds 10MB limit', details: [] });
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'Only PDF files are allowed', details: [] });
    }

    const request = await this.findRequestOrFail(id);
    if (request.type !== 'HIRING_REQUEST') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Only HIRING_REQUEST type supports PDF upload', details: [] });
    }
    if (request.status !== 'APPROVED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Request must be APPROVED before uploading contract PDF', details: [] });
    }

    if (!fs.existsSync(HIRING_PDF_DIR)) {
      fs.mkdirSync(HIRING_PDF_DIR, { recursive: true });
    }

    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const diskPath = path.join(HIRING_PDF_DIR, safeName);
    fs.writeFileSync(diskPath, file.buffer);

    return this.prisma.request.update({
      where: { id },
      data: {
        hiringContractPdfUrl: diskPath,
        hiringCompletedAt: new Date(),
        hiringCompletedBy: userId,
      } as any,
      select: {
        id: true,
        hiringContractPdfUrl: true,
        hiringCompletedAt: true,
        hiringCompletedBy: true,
      } as any,
    });
  }

  // B.7: Get hiring contract PDF path for download
  async getHiringPdfPath(id: string) {
    const request = await this.findRequestOrFail(id);
    const pdfUrl = (request as any).hiringContractPdfUrl;
    if (!pdfUrl) {
      throw new NotFoundException({ code: 'PDF_NOT_FOUND', message: 'No hiring contract PDF uploaded for this request', details: [] });
    }
    if (!fs.existsSync(pdfUrl)) {
      throw new NotFoundException({ code: 'FILE_NOT_ON_DISK', message: 'PDF file no longer exists on disk', details: [] });
    }
    return { filePath: pdfUrl, requestNumber: request.requestNumber };
  }

  private async findRequestOrFail(id: string) {
    const request = await this.prisma.request.findFirst({ where: { id, deletedAt: null } });
    if (!request) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Request not found', details: [{ field: 'id', value: id }] });
    }
    return request;
  }
}
