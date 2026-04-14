import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests.query.dto';
import { ApprovalService } from './approval.service';
import { validateRequestDetails } from './validators/request-details.validator';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalService: ApprovalService,
  ) {}

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

  async create(dto: CreateRequestDto, userId: string) {
    const employeeId = await this.getEmployeeIdByUserId(userId);
    if (!employeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No employee record found for this user',
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
            reason: dto.reason,
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

    // التحقق من تسليم العهد قبل تقديم طلب الاستقالة
    if (request.type === 'RESIGNATION') {
      const unreturned = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM users.custodies
        WHERE "employeeId" = ${request.employeeId}
          AND status = 'WITH_EMPLOYEE'
          AND "deletedAt" IS NULL
      `;
      if (Number(unreturned[0]?.count ?? 0) > 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'لا يمكن تقديم طلب استقالة قبل تسليم جميع العهد',
          details: [],
        });
      }
    }

    const initialized = await this.approvalService.initializeApprovalSteps(id, request.type);
    const toStatus = initialized ? 'IN_APPROVAL' : 'PENDING_MANAGER';

    if (!initialized) {
      await this.prisma.request.update({ where: { id }, data: { status: 'PENDING_MANAGER' } });
    }

    await this.prisma.requestHistory.create({
      data: { requestId: id, action: 'SUBMITTED', fromStatus: 'DRAFT', toStatus, performedBy: employeeId! },
    });

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
    return this.approvalService.approve(id, userId, dto.notes);
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
    return this.approvalService.approve(id, userId, dto.notes);
  }

  async managerReject(id: string, userId: string, dto: RejectRequestDto) {
    return this.approvalService.reject(id, userId, dto.notes);
  }

  // deprecated: redirected to ApprovalService to enforce canApprove checks
  async hrApprove(id: string, userId: string, dto: ApproveRequestDto) {
    return this.approvalService.approve(id, userId, dto.notes);
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

  private async findRequestOrFail(id: string) {
    const request = await this.prisma.request.findFirst({ where: { id, deletedAt: null } });
    if (!request) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Request not found', details: [{ field: 'id', value: id }] });
    }
    return request;
  }
}
