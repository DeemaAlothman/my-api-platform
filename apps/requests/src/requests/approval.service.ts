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

  async initializeApprovalSteps(
    requestId: string,
    requestType: string,
    employeeId?: string,
    submitterCtx?: { userId: string; employeeId: string },
  ): Promise<boolean> {
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

    // DM == HR dedup عام: إذا كان المدير المباشر للموظف هو نفسه HR → موافقة واحدة كـ HR فقط
    // (يُطبّق على كل الأنواع التي فيها خطوتا DIRECT_MANAGER + HR، ما عدا REWARD/PENALTY اللي عندها منطق خاص)
    if (!['REWARD', 'PENALTY_PROPOSAL'].includes(requestType) &&
        employeeId &&
        workflows.some(w => w.approverRole === 'DIRECT_MANAGER') &&
        workflows.some(w => w.approverRole === 'HR')) {
      const isDMAlsoHR = await this.isDirectManagerAlsoHR(employeeId);
      if (isDMAlsoHR) {
        workflows = workflows.filter(w => w.approverRole !== 'DIRECT_MANAGER');
        workflows = workflows.map((w, i) => ({ ...w, stepOrder: i + 1 }));
      }
    }

    // تخطي خطوات ذكي لطلبات المكافأة والعقوبة حسب دور المقدِّم
    if (['REWARD', 'PENALTY_PROPOSAL'].includes(requestType) && submitterCtx) {
      const req = await this.prisma.request.findFirst({ where: { id: requestId }, select: { details: true } });
      const details = req?.details as any;
      const targetEmpId: string | null = requestType === 'PENALTY_PROPOSAL'
        ? (details?.targetEmployeeId ?? null)
        : (details?.employees?.[0]?.employeeId ?? null);

      if (targetEmpId) {
        // مدير الموظف المستهدف وهل هو أيضاً HR
        const mgr = await this.prisma.$queryRaw<Array<{ mgrEmpId: string | null; mgrUserId: string | null }>>`
          SELECT e2.id AS "mgrEmpId", e2."userId" AS "mgrUserId"
          FROM users.employees e
          LEFT JOIN users.employees e2 ON e2.id = e."managerId"
          WHERE e.id = ${targetEmpId} AND e."deletedAt" IS NULL LIMIT 1
        `;
        const mgrEmpId   = mgr[0]?.mgrEmpId   ?? null;
        const mgrUserId  = mgr[0]?.mgrUserId  ?? null;

        const isSubmitterDM = mgrEmpId !== null && mgrEmpId === submitterCtx.employeeId;
        const isSubmitterHR = await this.resolver.hasPermission(submitterCtx.userId, 'requests:hr-approve');
        const isDMAlsoHR    = mgrUserId ? await this.resolver.hasPermission(mgrUserId, 'requests:hr-approve') : false;

        if (isSubmitterDM) {
          // المقدِّم هو المدير المباشر → تخطي خطوته
          workflows = workflows.filter(w => w.approverRole !== 'DIRECT_MANAGER');
          // لو كان المدير المباشر = HR فلا يوافق مرة ثانية كـ HR
          if (isDMAlsoHR) workflows = workflows.filter(w => w.approverRole !== 'HR');
        } else if (isSubmitterHR) {
          // المقدِّم هو HR → تخطي خطوته
          workflows = workflows.filter(w => w.approverRole !== 'HR');
          // لو كان HR = المدير المباشر فلا يوافق مرة ثانية كـ DM
          if (isDMAlsoHR) workflows = workflows.filter(w => w.approverRole !== 'DIRECT_MANAGER');
        } else if (isDMAlsoHR) {
          // المقدِّم ليس DM ولا HR، لكن الـ DM والـ HR شخص واحد → دمج إلى خطوة HR واحدة
          workflows = workflows.filter(w => w.approverRole !== 'DIRECT_MANAGER');
        }

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

  private async isDirectManagerAlsoHR(employeeId: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM users.employees target
      JOIN users.employees mgr ON mgr.id = target."managerId"
      JOIN users.user_roles ur ON ur."userId" = mgr."userId"
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      WHERE target.id = ${employeeId}
        AND p.name = 'requests:hr-approve'
        AND mgr."deletedAt" IS NULL
        AND target."deletedAt" IS NULL
    `;
    return Number(result[0]?.count ?? 0) > 0;
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
    // بعد مقابلة الخروج (exitInterview محفوظة بالتفاصيل) تبقى خطوة CEO الأخيرة فقط → اعتماد نهائي
    const exitInterviewDone = isResignation && !!(request.details as any)?.exitInterview;
    const newStatus = nextStep
      ? 'IN_APPROVAL'
      : (isResignation && !exitInterviewDone ? 'PENDING_EXIT_INTERVIEW' : 'APPROVED');
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
        action: fullyApproved ? 'APPROVED' : 'STEP_APPROVED',
        stepRole: currentStep.approverRole,
        employeeId: request.employeeId,
        details: updatedDetails,
      });
      // إشعار المعتمد التالي بأن الطلب وصل إلى مرحلته
      if (!fullyApproved && nextStep) {
        await this.notifications.notifyNextApproverRewardPenalty({
          requestId,
          requestType: request.type as 'REWARD' | 'PENALTY_PROPOSAL',
          nextRole: nextStep.approverRole,
          employeeId: request.employeeId,
          details: updatedDetails,
        });
      }
    }

    // إشعارات طلب العمل الإضافي
    if (request.type === 'OVERTIME_EMPLOYEE') {
      await this.notifications.notifyOvertimeTransition({
        requestId,
        employeeId: request.employeeId,
        nextRole: fullyApproved ? undefined : nextStep?.approverRole,
        approved: true,
      });
    }

    // Execute side effects on final approval (resignation: only after exit interview + CEO step)
    if (fullyApproved && (!isResignation || exitInterviewDone)) {
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

    // إشعار رفض طلب العمل الإضافي للموظف
    if (request.type === 'OVERTIME_EMPLOYEE') {
      await this.notifications.notifyOvertimeTransition({
        requestId,
        employeeId: request.employeeId,
        nextRole: undefined,
        approved: false,
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
        // بعد إتمام مقابلة الخروج: الموظف يصير غير نشط (INACTIVE)
        await this.prisma.$queryRawUnsafe(
          `UPDATE users.employees SET "employmentStatus" = 'INACTIVE', "updatedAt" = NOW() WHERE id = $1`,
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

      if (['OVERTIME_EMPLOYEE', 'OVERTIME_MANAGER'].includes(request.type)) {
        await this.recomputeOvertimeForRequest(request);
      }

      // إشعار الموظف المفوَّض إليه عند اعتماد طلب التفويض عبر مسار الموافقة العادي
      if (request.type === 'DELEGATION' && details?.delegateEmployeeId) {
        await this.notifications.notifyDelegationApproved({
          requestId: request.id,
          delegateEmployeeId: details.delegateEmployeeId,
        });
      }

      // BUSINESS_MISSION, HIRING_REQUEST, COMPLAINT, OTHER:
      // No automatic side effects — HR follows up manually after approval

    } catch (err) {
      console.error(`[executeApprovedRequest] failed for request ${request.id}:`, (err as any)?.message);
    }
  }

  /**
   * Section 1-د: عند اعتماد طلب أوفرتايم → أعد حساب overtime للسجلات المرتبطة مباشرةً
   */
  private async recomputeOvertimeForRequest(request: any): Promise<void> {
    const details = request.details as any;

    let employeeIds: string[];
    let dates: string[];

    if (request.type === 'OVERTIME_EMPLOYEE') {
      employeeIds = [request.employeeId];
      dates = details.overtimeDate ? [details.overtimeDate] : [];
    } else {
      employeeIds = Array.isArray(details.employeeIds) ? details.employeeIds : [];
      if (!details.startDate || !details.endDate) return;
      dates = [];
      const cur = new Date(details.startDate + 'T00:00:00Z');
      const last = new Date(details.endDate + 'T00:00:00Z');
      while (cur <= last) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    if (!dates.length || !employeeIds.length) return;

    const capMinutes = (parseFloat(details.totalHours ?? '0') || 0) * 60;
    const startTime  = details.startTime  as string | undefined;
    const endTime    = details.endTime    as string | undefined;

    for (const dateStr of dates) {
      const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay();
      const isWeekend = dow === 5 || dow === 6;

      for (const empId of employeeIds) {
        try {
          const recs = await this.prisma.$queryRawUnsafe<Array<{
            id: string; clockInTime: Date; clockOutTime: Date;
            workedMinutes: number | null;
            workStartTime: string; workEndTime: string;
            shiftType: string; minimumWorkMinutes: number | null;
          }>>(
            `SELECT ar.id, ar."clockInTime", ar."clockOutTime", ar."workedMinutes",
                    COALESCE(ws."workStartTime", '') AS "workStartTime",
                    COALESCE(ws."workEndTime",   '') AS "workEndTime",
                    COALESCE(ws."shiftType", 'DAY')  AS "shiftType",
                    ws."minimumWorkMinutes"
             FROM attendance.attendance_records ar
             LEFT JOIN attendance.employee_schedules es
               ON es."employeeId" = ar."employeeId"
               AND $1::date BETWEEN es."effectiveFrom"::date
                   AND COALESCE(es."effectiveTo"::date, '9999-12-31'::date)
               AND es."isActive" = true
             LEFT JOIN attendance.work_schedules ws ON ws.id = es."scheduleId"
             WHERE ar."employeeId" = $2
               AND ar.date = $1::date
               AND ar."clockInTime"  IS NOT NULL
               AND ar."clockOutTime" IS NOT NULL`,
            dateStr, empId,
          );

          if (!recs[0]) continue;
          const rec = recs[0];

          let overtimeWorkday = 0;
          let overtimeHoliday = 0;

          if (isWeekend) {
            overtimeHoliday = Math.min(rec.workedMinutes ?? 0, capMinutes);
          } else if (rec.shiftType === 'FLEXIBLE') {
            const aboveMin = Math.max(0, (rec.workedMinutes ?? 0) - (rec.minimumWorkMinutes ?? 480));
            const intersect = this.calcWindowIntersect(rec.clockInTime, rec.clockOutTime, dateStr, startTime, endTime);
            overtimeWorkday = Math.min(aboveMin, Math.min(intersect, capMinutes));
          } else if (rec.workStartTime && rec.workEndTime) {
            const [sH, sM] = rec.workStartTime.split(':').map(Number);
            const [eH, eM] = rec.workEndTime.split(':').map(Number);
            const base = new Date(dateStr + 'T00:00:00Z');
            const shiftStart = new Date(base); shiftStart.setUTCHours(sH - 3, sM, 0, 0);
            const shiftEnd   = new Date(base); shiftEnd.setUTCHours(eH - 3, eM, 0, 0);
            if (shiftEnd <= shiftStart) shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);

            const preShift  = Math.max(0, Math.floor((Math.min(rec.clockOutTime.getTime(), shiftStart.getTime()) - rec.clockInTime.getTime()) / 60000));
            const postShift = Math.max(0, Math.floor((rec.clockOutTime.getTime() - Math.max(rec.clockInTime.getTime(), shiftEnd.getTime())) / 60000));
            const outsideShift = preShift + postShift;

            const windowIntersect = this.calcWindowIntersect(rec.clockInTime, rec.clockOutTime, dateStr, startTime, endTime);
            overtimeWorkday = Math.min(Math.min(windowIntersect, outsideShift), capMinutes);
          }

          await this.prisma.$queryRawUnsafe(
            `UPDATE attendance.attendance_records
             SET "overtimeWorkdayMinutes" = $1, "overtimeHolidayMinutes" = $2,
                 "overtimeMinutes" = $3, "overtimeRequestId" = $4, "updatedAt" = NOW()
             WHERE id = $5`,
            overtimeWorkday, overtimeHoliday, overtimeWorkday + overtimeHoliday, request.id, rec.id,
          );
        } catch (err) {
          console.error(`[recomputeOvertimeForRequest] ${empId} on ${dateStr}:`, (err as any)?.message);
        }
      }
    }
  }

  private calcWindowIntersect(clockIn: Date, clockOut: Date, dateStr: string, windowStart?: string, windowEnd?: string): number {
    if (!windowStart || !windowEnd) return 0;
    const [wsH, wsM] = windowStart.split(':').map(Number);
    const [weH, weM] = windowEnd.split(':').map(Number);
    const base = new Date(dateStr + 'T00:00:00Z');
    const wStart = new Date(base); wStart.setUTCHours(wsH - 3, wsM, 0, 0);
    const wEnd   = new Date(base); wEnd.setUTCHours(weH - 3, weM, 0, 0);
    if (wEnd <= wStart) wEnd.setUTCDate(wEnd.getUTCDate() + 1);
    const start = Math.max(clockIn.getTime(), wStart.getTime());
    const end   = Math.min(clockOut.getTime(), wEnd.getTime());
    return Math.max(0, Math.floor((end - start) / 60000));
  }
}
