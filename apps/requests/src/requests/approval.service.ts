import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalResolverService } from './approval-resolver.service';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ApprovalResolverService,
  ) {}

  async initializeApprovalSteps(requestId: string, requestType: string): Promise<boolean> {
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: { requestType: requestType as any },
      orderBy: { stepOrder: 'asc' },
    });

    if (workflows.length === 0) return false;

    await this.prisma.approvalStep.createMany({
      data: workflows.map(w => ({
        id: require('crypto').randomUUID(),
        requestId,
        stepOrder: w.stepOrder,
        approverRole: w.approverRole,
        status: 'PENDING' as any,
      })),
    });

    await this.prisma.request.update({
      where: { id: requestId },
      data: { status: 'IN_APPROVAL', currentStepOrder: 1 },
    });

    return true;
  }

  async approve(requestId: string, approverUserId: string, notes?: string) {
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, deletedAt: null },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!request) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Request not found', details: [] });
    }
    if (request.status !== 'IN_APPROVAL') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Request is not in approval process', details: [] });
    }

    const currentStep = (request.approvalSteps as any[]).find(
      s => s.stepOrder === request.currentStepOrder && s.status === 'PENDING',
    );
    if (!currentStep) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'No pending approval step found', details: [] });
    }

    const canApprove = await this.resolver.canApprove(
      approverUserId,
      request.employeeId,
      currentStep.approverRole,
      request.details as any,
    );
    if (!canApprove) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'You are not authorized to approve this step', details: [] });
    }

    const reviewerId = (await this.resolver.getEmployeeIdByUserId(approverUserId)) ?? approverUserId;

    await this.prisma.approvalStep.update({
      where: { id: currentStep.id },
      data: { status: 'APPROVED', reviewedBy: reviewerId, reviewedAt: new Date(), notes },
    });

    const nextStep = (request.approvalSteps as any[]).find(
      s => s.stepOrder === (request.currentStepOrder! + 1),
    );

    const newStatus = nextStep ? 'IN_APPROVAL' : 'APPROVED';
    const newStepOrder = nextStep ? nextStep.stepOrder : currentStep.stepOrder;

    await this.prisma.request.update({
      where: { id: requestId },
      data: { status: newStatus as any, currentStepOrder: newStepOrder },
    });

    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action: 'STEP_APPROVED',
        fromStatus: 'IN_APPROVAL',
        toStatus: newStatus,
        performedBy: reviewerId,
        notes: `Step ${currentStep.stepOrder} (${currentStep.approverRole}) approved${notes ? ': ' + notes : ''}`,
      },
    });

    // تنفيذ الإجراء الفعلي عند اكتمال الاعتماد
    if (newStatus === 'APPROVED') {
      await this.executeApprovedRequest(request);
    }

    return this.prisma.request.findFirst({
      where: { id: requestId },
      include: {
        approvalSteps: { orderBy: { stepOrder: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  async reject(requestId: string, approverUserId: string, notes: string) {
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, deletedAt: null },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!request) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Request not found', details: [] });
    }
    if (request.status !== 'IN_APPROVAL') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Request is not in approval process', details: [] });
    }

    const currentStep = (request.approvalSteps as any[]).find(
      s => s.stepOrder === request.currentStepOrder && s.status === 'PENDING',
    );
    if (!currentStep) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'No pending approval step found', details: [] });
    }

    const canApprove = await this.resolver.canApprove(
      approverUserId,
      request.employeeId,
      currentStep.approverRole,
      request.details as any,
    );
    if (!canApprove) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'You are not authorized to reject this step', details: [] });
    }

    const reviewerId = (await this.resolver.getEmployeeIdByUserId(approverUserId)) ?? approverUserId;

    await this.prisma.approvalStep.update({
      where: { id: currentStep.id },
      data: { status: 'REJECTED', reviewedBy: reviewerId, reviewedAt: new Date(), notes },
    });

    await this.prisma.request.update({
      where: { id: requestId },
      data: { status: 'REJECTED' as any },
    });

    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action: 'STEP_REJECTED',
        fromStatus: 'IN_APPROVAL',
        toStatus: 'REJECTED',
        performedBy: reviewerId,
        notes: `Step ${currentStep.stepOrder} (${currentStep.approverRole}) rejected: ${notes}`,
      },
    });

    return this.prisma.request.findFirst({
      where: { id: requestId },
      include: {
        approvalSteps: { orderBy: { stepOrder: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  async getApprovalSteps(requestId: string) {
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, deletedAt: null },
    });
    if (!request) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Request not found', details: [] });
    }
    return this.prisma.approvalStep.findMany({
      where: { requestId },
      orderBy: { stepOrder: 'asc' },
    });
  }

  async getPendingMyApproval(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const allPending = await this.prisma.request.findMany({
      where: { status: 'IN_APPROVAL', deletedAt: null },
      include: { approvalSteps: true },
      orderBy: { createdAt: 'desc' },
    });

    const myRequests: any[] = [];
    for (const req of allPending) {
      const currentStep = (req.approvalSteps as any[]).find(
        s => s.stepOrder === req.currentStepOrder && s.status === 'PENDING',
      );
      if (!currentStep) continue;

      const canApprove = await this.resolver.canApprove(
        userId,
        req.employeeId,
        currentStep.approverRole,
        req.details as any,
      );
      if (canApprove) myRequests.push({ ...req, currentStep });
    }

    const total = myRequests.length;
    const items = myRequests.slice(skip, skip + limit);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  private async executeApprovedRequest(request: any): Promise<void> {
    try {
      const details = request.details as any;
      console.log(`[executeApprovedRequest/approval] type=${request.type} employeeId=${request.employeeId} details=${JSON.stringify(details)}`);
      if (request.type === 'TRANSFER') {
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;
        if (details?.newDepartmentId) { updates.push(`"departmentId" = $${idx++}`); values.push(details.newDepartmentId); }
        if (details?.newJobTitleId)   { updates.push(`"jobTitleId" = $${idx++}`);   values.push(details.newJobTitleId); }
        console.log(`[executeApprovedRequest/approval] updates=${JSON.stringify(updates)} values=${JSON.stringify(values)}`);
        if (updates.length > 0) {
          values.push(request.employeeId);
          const sql = `UPDATE users.employees SET ${updates.join(', ')} WHERE id = $${idx}`;
          console.log(`[executeApprovedRequest/approval] sql=${sql}`);
          await this.prisma.$queryRawUnsafe(sql, ...values);
          console.log(`[executeApprovedRequest/approval] done`);
        }
      }
    } catch (err) {
      console.error(`[executeApprovedRequest/approval] failed for request ${request.id}:`, (err as any)?.message, (err as any)?.stack);
    }
  }
}
