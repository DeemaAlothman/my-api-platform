import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type NotifAction = 'SUBMITTED' | 'STEP_APPROVED' | 'STEP_REJECTED' | 'APPROVED' | 'REJECTED';

@Injectable()
export class RequestNotificationsService {
  private readonly logger = new Logger(RequestNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyRewardPenalty(params: {
    requestId: string;
    requestType: 'REWARD' | 'PENALTY_PROPOSAL';
    action: NotifAction;
    stepRole?: string;
    employeeId: string;
    details: any;
  }) {
    try {
      const notifyEmployeeIds = new Set<string>();

      // Requester (HR/manager who submitted)
      notifyEmployeeIds.add(params.employeeId);

      // Target employees from details
      if (params.requestType === 'PENALTY_PROPOSAL' && params.details?.targetEmployeeId) {
        notifyEmployeeIds.add(params.details.targetEmployeeId);
      }
      if (params.requestType === 'REWARD' && Array.isArray(params.details?.employees)) {
        for (const emp of params.details.employees) {
          if (emp.employeeId) notifyEmployeeIds.add(emp.employeeId);
        }
      }

      // Add direct managers of all involved employees
      const involvedIds = [...notifyEmployeeIds];
      if (involvedIds.length > 0) {
        const ph = involvedIds.map((_, i) => `$${i + 1}`).join(', ');
        const managers = await this.prisma.$queryRawUnsafe<Array<{ managerId: string }>>(
          `SELECT DISTINCT "managerId" FROM users.employees WHERE id IN (${ph}) AND "managerId" IS NOT NULL AND "deletedAt" IS NULL`,
          ...involvedIds,
        );
        for (const m of managers) {
          if (m.managerId) notifyEmployeeIds.add(m.managerId);
        }
      }

      // Add HR employees (those with requests:hr-approve permission)
      const hrEmployees = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT DISTINCT e.id
        FROM users.employees e
        JOIN users.users u ON u.id = e."userId"
        JOIN users.user_roles ur ON ur."userId" = u.id
        JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
        JOIN users.permissions p ON p.id = rp."permissionId"
        WHERE p.name = 'requests:hr-approve'
          AND e."deletedAt" IS NULL
          AND u.status = 'ACTIVE'
      `;
      for (const e of hrEmployees) notifyEmployeeIds.add(e.id);

      if (notifyEmployeeIds.size === 0) return;

      // Resolve employeeId → userId
      const allEmpIds = [...notifyEmployeeIds];
      const ph2 = allEmpIds.map((_, i) => `$${i + 1}`).join(', ');
      const userRows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT "userId" FROM users.employees WHERE id IN (${ph2}) AND "userId" IS NOT NULL AND "deletedAt" IS NULL`,
        ...allEmpIds,
      );
      const userIds = userRows.map(r => r.userId).filter(Boolean);
      if (userIds.length === 0) return;

      const { notifType, titleAr, titleEn, messageAr, messageEn } = this.buildContent(
        params.requestType,
        params.action,
        params.stepRole,
      );

      for (const userId of userIds) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2::"users"."NotificationType", $3, $4, $5, $6, $7::jsonb, NOW())`,
          userId,
          notifType,
          titleAr,
          titleEn,
          messageAr,
          messageEn,
          JSON.stringify({ requestId: params.requestId, requestType: params.requestType }),
        );
      }
    } catch (err) {
      this.logger.error(
        `[notifyRewardPenalty] failed for request ${params.requestId}: ${(err as any)?.message}`,
      );
    }
  }

  private buildContent(requestType: string, action: NotifAction, stepRole?: string) {
    const isReward = requestType === 'REWARD';
    const typeAr = isReward ? 'المكافأة' : 'العقوبة';
    const typeEn = isReward ? 'Reward' : 'Penalty';
    const notifType = isReward ? 'REWARD_DECISION' : 'PENALTY_DECISION';

    switch (action) {
      case 'SUBMITTED':
        return {
          notifType,
          titleAr: `طلب ${typeAr} جديد`,
          titleEn: `New ${typeEn} Request`,
          messageAr: `تم تقديم طلب ${typeAr} وهو بانتظار المراجعة`,
          messageEn: `A ${typeEn.toLowerCase()} request has been submitted and is pending review`,
        };
      case 'STEP_APPROVED':
        return {
          notifType,
          titleAr: `موافقة على خطوة — ${typeAr}`,
          titleEn: `${typeEn} Step Approved`,
          messageAr: `تمت الموافقة على خطوة ${stepRole ?? ''} في طلب ${typeAr}`,
          messageEn: `Step ${stepRole ?? ''} of the ${typeEn.toLowerCase()} request was approved`,
        };
      case 'APPROVED':
        return {
          notifType,
          titleAr: `اعتماد ${typeAr} نهائياً`,
          titleEn: `${typeEn} Finally Approved`,
          messageAr: `تم اعتماد طلب ${typeAr} بشكل نهائي`,
          messageEn: `The ${typeEn.toLowerCase()} request has been finally approved`,
        };
      case 'STEP_REJECTED':
      case 'REJECTED':
        return {
          notifType,
          titleAr: `رفض طلب ${typeAr}`,
          titleEn: `${typeEn} Request Rejected`,
          messageAr: `تم رفض طلب ${typeAr}`,
          messageEn: `The ${typeEn.toLowerCase()} request has been rejected`,
        };
    }
  }
}
