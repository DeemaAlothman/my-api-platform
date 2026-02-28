import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests.query.dto';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  // جلب employeeId من userId عبر cross-schema query
  private async getEmployeeIdByUserId(userId: string): Promise<string | null> {
    const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users.employees WHERE "userId" = ${userId} AND "deletedAt" IS NULL LIMIT 1
    `;
    return result[0]?.id ?? null;
  }

  // توليد رقم طلب تسلسلي
  private async generateRequestNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.request.count();
    const seq = String(count + 1).padStart(6, '0');
    return `REQ-${year}-${seq}`;
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

    const requestNumber = await this.generateRequestNumber();

    return this.prisma.request.create({
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

    const updated = await this.prisma.request.update({
      where: { id },
      data: { status: 'PENDING_MANAGER' },
    });

    await this.prisma.requestHistory.create({
      data: { requestId: id, action: 'SUBMITTED', fromStatus: 'DRAFT', toStatus: 'PENDING_MANAGER', performedBy: employeeId },
    });

    return updated;
  }

  async managerApprove(id: string, userId: string, dto: ApproveRequestDto) {
    const request = await this.findRequestOrFail(id);
    if (request.status !== 'PENDING_MANAGER') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Request is not pending manager approval', details: [] });
    }

    const reviewerId = (await this.getEmployeeIdByUserId(userId)) ?? userId;
    const updated = await this.prisma.request.update({
      where: { id },
      data: {
        status: 'PENDING_HR',
        managerStatus: 'APPROVED',
        managerReviewedBy: reviewerId,
        managerReviewedAt: new Date(),
        managerNotes: dto.notes,
      },
    });

    await this.prisma.requestHistory.create({
      data: { requestId: id, action: 'MANAGER_APPROVED', fromStatus: 'PENDING_MANAGER', toStatus: 'PENDING_HR', performedBy: reviewerId, notes: dto.notes },
    });

    return updated;
  }

  async managerReject(id: string, userId: string, dto: RejectRequestDto) {
    const request = await this.findRequestOrFail(id);
    if (request.status !== 'PENDING_MANAGER') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Request is not pending manager approval', details: [] });
    }

    const reviewerId = (await this.getEmployeeIdByUserId(userId)) ?? userId;
    const updated = await this.prisma.request.update({
      where: { id },
      data: {
        status: 'REJECTED',
        managerStatus: 'REJECTED',
        managerReviewedBy: reviewerId,
        managerReviewedAt: new Date(),
        managerNotes: dto.notes,
      },
    });

    await this.prisma.requestHistory.create({
      data: { requestId: id, action: 'MANAGER_REJECTED', fromStatus: 'PENDING_MANAGER', toStatus: 'REJECTED', performedBy: reviewerId, notes: dto.notes },
    });

    return updated;
  }

  async hrApprove(id: string, userId: string, dto: ApproveRequestDto) {
    const request = await this.findRequestOrFail(id);
    if (request.status !== 'PENDING_HR') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Request is not pending HR approval', details: [] });
    }

    const reviewerId = (await this.getEmployeeIdByUserId(userId)) ?? userId;
    const updated = await this.prisma.request.update({
      where: { id },
      data: {
        status: 'APPROVED',
        hrStatus: 'APPROVED',
        hrReviewedBy: reviewerId,
        hrReviewedAt: new Date(),
        hrNotes: dto.notes,
      },
    });

    await this.prisma.requestHistory.create({
      data: { requestId: id, action: 'HR_APPROVED', fromStatus: 'PENDING_HR', toStatus: 'APPROVED', performedBy: reviewerId, notes: dto.notes },
    });

    return updated;
  }

  async hrReject(id: string, userId: string, dto: RejectRequestDto) {
    const request = await this.findRequestOrFail(id);
    if (request.status !== 'PENDING_HR') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Request is not pending HR approval', details: [] });
    }

    const reviewerId = (await this.getEmployeeIdByUserId(userId)) ?? userId;
    const updated = await this.prisma.request.update({
      where: { id },
      data: {
        status: 'REJECTED',
        hrStatus: 'REJECTED',
        hrReviewedBy: reviewerId,
        hrReviewedAt: new Date(),
        hrNotes: dto.notes,
      },
    });

    await this.prisma.requestHistory.create({
      data: { requestId: id, action: 'HR_REJECTED', fromStatus: 'PENDING_HR', toStatus: 'REJECTED', performedBy: reviewerId, notes: dto.notes },
    });

    return updated;
  }

  async cancel(id: string, userId: string, dto: CancelRequestDto) {
    const request = await this.findRequestOrFail(id);
    const employeeId = await this.getEmployeeIdByUserId(userId);

    if (request.employeeId !== employeeId) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'Not your request', details: [] });
    }
    if (!['DRAFT', 'PENDING_MANAGER'].includes(request.status)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cannot cancel request at this stage', details: [] });
    }

    const updated = await this.prisma.request.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.reason,
        cancelledAt: new Date(),
        cancelledBy: employeeId,
      },
    });

    await this.prisma.requestHistory.create({
      data: { requestId: id, action: 'CANCELLED', fromStatus: request.status, toStatus: 'CANCELLED', performedBy: employeeId, notes: dto.reason },
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
        },
      }),
      this.prisma.request.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async myRequests(userId: string, query: ListRequestsQueryDto) {
    const employeeId = await this.getEmployeeIdByUserId(userId);
    if (!employeeId) return { items: [], page: 1, limit: 10, total: 0, totalPages: 1 };

    return this.list({ ...query, employeeId });
  }

  async findOne(id: string) {
    const request = await this.prisma.request.findFirst({
      where: { id, deletedAt: null },
      include: {
        history: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!request) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Request not found', details: [{ field: 'id', value: id }] });
    }

    return request;
  }

  private async findRequestOrFail(id: string) {
    const request = await this.prisma.request.findFirst({ where: { id, deletedAt: null } });
    if (!request) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Request not found', details: [{ field: 'id', value: id }] });
    }
    return request;
  }
}
