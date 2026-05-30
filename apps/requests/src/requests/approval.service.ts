import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalResolverService } from './approval-resolver.service';
import { RequestNotificationsService } from './notifications.service';

interface ApproveDto {
  notes?: string;
  penaltyDays?: number;
  amount?: number;
  executiveRecommendation?: string;
}

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ApprovalResolverService,
    private readonly notifications: RequestNotificationsService,
  ) {}

  async initializeApprovalSteps(requestId: string, requestType: string, employeeId?: string): Promise<boolean> {
    let workflows = await this.prisma.approvalWorkflow.findMany({
      where: { requestType: requestType as any },
      orderBy: { stepOrder: 'asc' },
    });

    if (workflows.length === 0) return false;

    // إذا كان المدير المباشر هو CEO: احذف خطوة CEO المنفصلة وابقِ DIRECT_MANAGER → HR
    if (employeeId && workflows.some(w => w.approverRole === 'DIRECT_MANAGER')) {
      const isManagerCeo = await this.isDirectManagerCeo(employeeId);
      if (isManagerCeo) {
        workflows = workflows.filter(w => w.approverRole !== 'CEO');
        workflows = workflows.map((w, i) => ({ ...w, stepOrder: i + 1 }));
      }
    }

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

  private async isDirectManagerCeo(employeeId: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<Array<{ managerId: string | null }>>`
      SELECT "managerId" FROM users.employees WHERE id = ${employeeId} AND "deletedAt" IS NULL LIMIT 1
    `;
    const managerId = result[0]?.managerId;
    if (!managerId) return false;

    const ceoCheck = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM users.user_roles ur
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      JOIN users.employees e ON e."userId" = ur."userId"
      WHERE e.id = ${managerId}
        AND p.name = 'requests:ceo-approve'
        AND e."deletedAt" IS NULL
    `;
    return Number(ceoCheck[0]?.count ?? 0) > 0;
  }

  async approve(requestId: string, approverUserId: string, dto: ApproveDto = {}) {
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

    // Merge HR/CEO-supplied fields into details for REWARD / PENALTY_PROPOSAL
    let updatedDetails = request.details as any;
    if (['REWARD', 'PENALTY_PROPOSAL'].includes(request.type)) {
      updatedDetails = { ...updatedDetails };
      if (dto.penaltyDays !== undefined) updatedDetails.penaltyDays = dto.penaltyDays;
      if (dto.amount !== undefined) updatedDetails.amount = dto.amount;
      if (dto.executiveRecommendation !== undefined) updatedDetails.executiveRecommendation = dto.executiveRecommendation;
      await this.prisma.request.update({ where: { id: requestId }, data: { details: updatedDetails } });
    }

    const nextStep = (request.approvalSteps as any[]).find(
      s => s.stepOrder === (request.currentStepOrder! + 1),
    );

    const fullyApproved = !nextStep;
    const isResignation = request.type === 'RESIGNATION';
    const newStatus = nextStep
      ? 'IN_APPROVAL'
      : (isResignation ? 'PENDING_EXIT_INTERVIEW' : 'APPROVED');
    const newStepOrder = nextStep ? nextStep.stepOrder : currentStep.stepOrder;

    await this.prisma.$transaction([
      this.prisma.approvalStep.update({
        where: { id: currentStep.id },
        data: { status: 'APPROVED', reviewedBy: reviewerId, reviewedAt: new Date(), notes: dto.notes },
      }),
      this.prisma.request.update({
        where: { id: requestId },
        data: { status: newStatus as any, currentStepOrder: newStepOrder },
      }),
    ]);

    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action: 'STEP_APPROVED',
        fromStatus: 'IN_APPROVAL',
        toStatus: newStatus,
        performedBy: reviewerId,
        notes: `Step ${currentStep.stepOrder} (${currentStep.approverRole}) approved${dto.notes ? ': ' + dto.notes : ''}`,
      },
    });

    // Notify relevant parties for REWARD / PENALTY_PROPOSAL
    if (['REWARD', 'PENALTY_PROPOSAL'].includes(request.type)) {
      await this.notifications.notifyRewardPenalty({
        requestId,
        requestType: request.type as 'REWARD' | 'PENALTY_PROPOSAL',
        action: fullyApproved && !isResignation ? 'APPROVED' : 'STEP_APPROVED',
        stepRole: currentStep.approverRole,
        employeeId: request.employeeId,
        details: updatedDetails,
      });
    }

    // Execute side effects on final approval (excluding resignation — awaits exit interview)
    if (fullyApproved && !isResignation) {
      await this.executeApprovedRequest({ ...request, details: updatedDetails });
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

    await this.prisma.$transaction([
      this.prisma.approvalStep.update({
        where: { id: currentStep.id },
        data: { status: 'REJECTED', reviewedBy: reviewerId, reviewedAt: new Date(), notes },
      }),
      this.prisma.request.update({
        where: { id: requestId },
        data: { status: 'REJECTED' as any },
      }),
    ]);

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

    // Notify relevant parties for REWARD / PENALTY_PROPOSAL
    if (['REWARD', 'PENALTY_PROPOSAL'].includes(request.type)) {
      await this.notifications.notifyRewardPenalty({
        requestId,
        requestType: request.type as 'REWARD' | 'PENALTY_PROPOSAL',
        action: 'REJECTED',
        stepRole: currentStep.approverRole,
        employeeId: request.employeeId,
        details: request.details,
      });
    }

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
    const offset = (page - 1) * limit;

    const approverEmployeeId = await this.resolver.getEmployeeIdByUserId(userId);
    const hasHrApprove  = await this.resolver.hasPermission(userId, 'requests:hr-approve');
    const hasCeoApprove = await this.resolver.hasPermission(userId, 'requests:ceo-approve');
    const hasCfoApprove = await this.resolver.hasPermission(userId, 'requests:cfo-approve');

    const baseConditions = `
      r.status = 'IN_APPROVAL'
      AND r."deletedAt" IS NULL
      AND s."stepOrder" = r."currentStepOrder"
      AND s.status = 'PENDING'
      AND (
        (s."approverRole" = 'DIRECT_MANAGER'
          AND ${approverEmployeeId ? `r."employeeId" IN (SELECT id FROM users.employees WHERE "managerId" = '${approverEmployeeId}' AND "deletedAt" IS NULL)` : 'false'})
        OR (s."approverRole" = 'DEPARTMENT_MANAGER'
          AND ${approverEmployeeId ? `r."employeeId" IN (
            SELECT e.id FROM users.employees e
            JOIN users.departments d ON e."departmentId" = d.id
            WHERE d."managerId" = '${approverEmployeeId}' AND e."deletedAt" IS NULL AND d."deletedAt" IS NULL
          )` : 'false'})
        OR (s."approverRole" = 'TARGET_MANAGER'
          AND ${approverEmployeeId ? `(r.details->>'newDepartmentId') IN (
            SELECT id FROM users.departments WHERE "managerId" = '${approverEmployeeId}' AND "deletedAt" IS NULL
          )` : 'false'})
        OR (s."approverRole" = 'HR'  AND ${hasHrApprove  ? 'true' : 'false'})
        OR (s."approverRole" = 'CEO' AND ${hasCeoApprove ? 'true' : 'false'})
        OR (s."approverRole" = 'CFO' AND ${hasCfoApprove ? 'true' : 'false'})
      )
    `;

    const countResult = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count
       FROM requests.requests r
       JOIN requests.approval_steps s ON s."requestId" = r.id
       WHERE ${baseConditions}`,
    );
    const total = Number(countResult[0]?.count ?? 0);

    const items = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.*, row_to_json(s) AS "currentStep"
       FROM requests.requests r
       JOIN requests.approval_steps s ON s."requestId" = r.id
       WHERE ${baseConditions}
       ORDER BY r."createdAt" DESC
       LIMIT ${limit} OFFSET ${offset}`,
    );

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async executeApprovedRequest(request: any): Promise<void> {
    try {
      const details = request.details as any;

      if (request.type === 'TRANSFER') {
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;
        if (details?.newDepartmentId) { updates.push(`"departmentId" = $${idx++}`); values.push(details.newDepartmentId); }
        if (details?.newJobTitleId)   { updates.push(`"jobTitleId" = $${idx++}`);   values.push(details.newJobTitleId); }
        if (updates.length > 0) {
          values.push(request.employeeId);
          await this.prisma.$queryRawUnsafe(
            `UPDATE users.employees SET ${updates.join(', ')} WHERE id = $${idx}`,
            ...values,
          );
        }
      }

      if (request.type === 'RESIGNATION') {
        await this.prisma.$queryRawUnsafe(
          `UPDATE users.employees SET "employmentStatus" = 'TERMINATED', "updatedAt" = NOW() WHERE id = $1`,
          request.employeeId,
        );
      }

      if (request.type === 'PENALTY_PROPOSAL' && details?.targetEmployeeId && details?.category) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.employee_rewards_penalties
            (id, "employeeId", kind, category, "penaltyDays", amount, "typeCode", reason, recommendation, "requestId", "issuedBy", status, "effectiveDate", "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'PENALTY', $2, $3, NULL, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), NOW())`,
          details.targetEmployeeId,
          details.category,
          details.category === 'MATERIAL' ? (Number(details.penaltyDays) || null) : null,
          details.penaltyType ?? null,
          details.violationDescription ?? null,
          details.executiveRecommendation ?? null,
          request.id,
          request.employeeId,
        );
      }

      if (request.type === 'REWARD' && Array.isArray(details?.employees)) {
        for (const emp of details.employees) {
          if (!emp.employeeId || !emp.category) continue;
          await this.prisma.$queryRawUnsafe(
            `INSERT INTO users.employee_rewards_penalties
              (id, "employeeId", kind, category, "penaltyDays", amount, "typeCode", reason, recommendation, "requestId", "issuedBy", status, "effectiveDate", "createdAt")
             VALUES (gen_random_uuid()::text, $1, 'REWARD', $2, NULL, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), NOW())`,
            emp.employeeId,
            emp.category,
            emp.category === 'MATERIAL' ? (Number(emp.amount) || null) : null,
            emp.rewardType ?? null,
            emp.reason ?? null,
            details.executiveRecommendation ?? null,
            request.id,
            request.employeeId,
          );
        }
      }

      // BUSINESS_MISSION, OVERTIME, DELEGATION, HIRING_REQUEST, COMPLAINT, OTHER:
      // No automatic side effects — HR follows up manually after approval

    } catch (err) {
      console.error(`[executeApprovedRequest] failed for request ${request.id}:`, (err as any)?.message);
    }
  }
}
