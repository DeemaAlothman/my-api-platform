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

  // إشعار المعتمد التالي عند انتقال خطوة في طلبات المكافأة/العقوبة
  async notifyNextApproverRewardPenalty(params: {
    requestId: string;
    requestType: 'REWARD' | 'PENALTY_PROPOSAL';
    nextRole: string;
    employeeId: string;
    details: any;
  }) {
    try {
      const typeAr = params.requestType === 'REWARD' ? 'المكافأة' : 'العقوبة';
      const typeEn = params.requestType === 'REWARD' ? 'Reward' : 'Penalty';

      // حدّد المعتمدين التاليين حسب الدور
      let approverUserIds: string[] = [];
      if (params.nextRole === 'HR') {
        const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
          SELECT DISTINCT e."userId"
          FROM users.employees e
          JOIN users.users u ON u.id = e."userId"
          JOIN users.user_roles ur ON ur."userId" = u.id
          JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
          JOIN users.permissions p ON p.id = rp."permissionId"
          WHERE p.name = 'requests:hr-approve'
            AND e."deletedAt" IS NULL AND e."userId" IS NOT NULL AND u.status = 'ACTIVE'
        `;
        approverUserIds = rows.map(r => r.userId);
      } else if (params.nextRole === 'CEO') {
        const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
          SELECT DISTINCT e."userId"
          FROM users.employees e
          JOIN users.users u ON u.id = e."userId"
          JOIN users.user_roles ur ON ur."userId" = u.id
          JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
          JOIN users.permissions p ON p.id = rp."permissionId"
          WHERE p.name = 'requests:ceo-approve'
            AND e."deletedAt" IS NULL AND e."userId" IS NOT NULL AND u.status = 'ACTIVE'
        `;
        approverUserIds = rows.map(r => r.userId);
      } else if (params.nextRole === 'DIRECT_MANAGER') {
        // الموظف مقدّم الطلب → نجيب مدير الموظف المستهدف
        const targetId = params.requestType === 'PENALTY_PROPOSAL'
          ? params.details?.targetEmployeeId
          : params.details?.employees?.[0]?.employeeId;
        if (targetId) {
          const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
            SELECT e2."userId"
            FROM users.employees e
            JOIN users.employees e2 ON e2.id = e."managerId"
            WHERE e.id = ${targetId} AND e."deletedAt" IS NULL AND e2."userId" IS NOT NULL LIMIT 1
          `;
          approverUserIds = rows.map(r => r.userId).filter(Boolean);
        }
      }

      if (approverUserIds.length === 0) return;

      for (const userId of approverUserIds) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2::"users"."NotificationType", $3, $4, $5, $6, $7::jsonb, NOW())`,
          userId, 'GENERAL',
          `طلب ${typeAr} بانتظار موافقتك`,
          `${typeEn} Request Awaiting Your Approval`,
          `يوجد طلب ${typeAr} وصل إلى مرحلة تتطلب موافقتك`,
          `A ${typeEn.toLowerCase()} request has reached your approval stage`,
          JSON.stringify({ requestId: params.requestId, requestType: params.requestType }),
        );
      }
    } catch (err) {
      this.logger.error(`[notifyNextApproverRewardPenalty] failed for ${params.requestId}: ${(err as any)?.message}`);
    }
  }

  // إشعارات مسار طلب العمل الإضافي (تقديم / انتقال خطوة / اعتماد نهائي / رفض)
  async notifyOvertimeTransition(params: {
    requestId: string;
    employeeId: string; // employee ID of the overtime requester
    nextRole?: string;  // undefined = fully approved or rejected
    approved: boolean;
  }) {
    try {
      let targetUserIds: string[] = [];

      if (params.nextRole === 'DIRECT_MANAGER') {
        // الموظف المدير المباشر
        const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
          SELECT e2."userId"
          FROM users.employees e
          JOIN users.employees e2 ON e2.id = e."managerId"
          WHERE e.id = ${params.employeeId} AND e."deletedAt" IS NULL AND e2."userId" IS NOT NULL LIMIT 1
        `;
        targetUserIds = rows.map(r => r.userId).filter(Boolean);
      } else if (params.nextRole === 'HR') {
        const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
          SELECT DISTINCT e."userId"
          FROM users.employees e
          JOIN users.users u ON u.id = e."userId"
          JOIN users.user_roles ur ON ur."userId" = u.id
          JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
          JOIN users.permissions p ON p.id = rp."permissionId"
          WHERE p.name = 'requests:hr-approve'
            AND e."deletedAt" IS NULL AND e."userId" IS NOT NULL AND u.status = 'ACTIVE'
        `;
        targetUserIds = rows.map(r => r.userId);
      } else if (params.nextRole === 'CEO') {
        const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
          SELECT DISTINCT e."userId"
          FROM users.employees e
          JOIN users.users u ON u.id = e."userId"
          JOIN users.user_roles ur ON ur."userId" = u.id
          JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
          JOIN users.permissions p ON p.id = rp."permissionId"
          WHERE p.name = 'requests:ceo-approve'
            AND e."deletedAt" IS NULL AND e."userId" IS NOT NULL AND u.status = 'ACTIVE'
        `;
        targetUserIds = rows.map(r => r.userId);
      } else {
        // اعتماد نهائي أو رفض → إشعار الموظف صاحب الطلب
        const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
          SELECT "userId" FROM users.employees WHERE id = ${params.employeeId} AND "userId" IS NOT NULL LIMIT 1
        `;
        targetUserIds = rows.map(r => r.userId).filter(Boolean);
      }

      if (targetUserIds.length === 0) return;

      const isApproved = params.approved;
      const hasPendingRole = !!params.nextRole;
      const titleAr = hasPendingRole
        ? 'طلب عمل إضافي بانتظار موافقتك'
        : (isApproved ? 'تمت الموافقة على طلب العمل الإضافي' : 'تم رفض طلب العمل الإضافي');
      const titleEn = hasPendingRole
        ? 'Overtime Request Awaiting Your Approval'
        : (isApproved ? 'Overtime Request Approved' : 'Overtime Request Rejected');
      const messageAr = hasPendingRole
        ? `طلب عمل إضافي وصل إلى مرحلة ${params.nextRole} ويتطلب موافقتك`
        : (isApproved ? 'تمت الموافقة على طلب العمل الإضافي الخاص بك' : 'تم رفض طلب العمل الإضافي الخاص بك');
      const messageEn = hasPendingRole
        ? `An overtime request has reached the ${params.nextRole} stage and requires your approval`
        : (isApproved ? 'Your overtime request has been approved' : 'Your overtime request has been rejected');

      for (const userId of targetUserIds) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2::"users"."NotificationType", $3, $4, $5, $6, $7::jsonb, NOW())`,
          userId, 'GENERAL', titleAr, titleEn, messageAr, messageEn,
          JSON.stringify({ requestId: params.requestId, requestType: 'OVERTIME_EMPLOYEE' }),
        );
      }
    } catch (err) {
      this.logger.error(`[notifyOvertimeTransition] failed for ${params.requestId}: ${(err as any)?.message}`);
    }
  }

  // إشعار الموظف المفوَّض إليه عند اعتماد طلب التفويض (تلقائياً من CEO أو بعد مسار الموافقة)
  async notifyDelegationApproved(params: { requestId: string; delegateEmployeeId: string }) {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId" FROM users.employees
        WHERE id = ${params.delegateEmployeeId} AND "userId" IS NOT NULL AND "deletedAt" IS NULL LIMIT 1
      `;
      const userId = rows[0]?.userId;
      if (!userId) return;

      await this.prisma.$queryRawUnsafe(
        `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2::"users"."NotificationType", $3, $4, $5, $6, $7::jsonb, NOW())`,
        userId, 'GENERAL',
        'تم تفويضك',
        'You Have Been Delegated',
        'تمت الموافقة على طلب تفويض يخصّك، يرجى الاطلاع على التفاصيل',
        'A delegation request assigned to you has been approved. Please review the details.',
        JSON.stringify({ requestId: params.requestId, requestType: 'DELEGATION' }),
      );
    } catch (err) {
      this.logger.error(`[notifyDelegationApproved] failed for ${params.requestId}: ${(err as any)?.message}`);
    }
  }

  // إشعار المدير التنفيذي (CEO) بأن طلب استقالة بانتظار موافقته بعد مقابلة الخروج
  async notifyCeoExitInterviewDone(params: { requestId: string; employeeId: string }) {
    try {
      const ceoEmployees = await this.prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT DISTINCT e."userId"
        FROM users.employees e
        JOIN users.users u ON u.id = e."userId"
        JOIN users.user_roles ur ON ur."userId" = u.id
        JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
        JOIN users.permissions p ON p.id = rp."permissionId"
        WHERE p.name = 'requests:ceo-approve'
          AND e."deletedAt" IS NULL
          AND e."userId" IS NOT NULL
          AND u.status = 'ACTIVE'
      `;
      const userIds = ceoEmployees.map(e => e.userId).filter(Boolean);
      if (userIds.length === 0) return;

      const employee = await this.prisma.$queryRaw<Array<{ name: string }>>`
        SELECT "firstNameAr" || ' ' || "lastNameAr" AS name FROM users.employees WHERE id = ${params.employeeId}
      `;
      const empName = employee[0]?.name ?? '';

      for (const userId of userIds) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2::"users"."NotificationType", $3, $4, $5, $6, $7::jsonb, NOW())`,
          userId,
          'GENERAL',
          'طلب استقالة بانتظار موافقتك',
          'Resignation Request Awaiting Your Approval',
          `استكمل الموظف ${empName} مقابلة الخروج، وطلب الاستقالة بانتظار موافقتك النهائية`,
          `${empName} has completed the exit interview; their resignation request is awaiting your final approval`,
          JSON.stringify({ requestId: params.requestId, requestType: 'RESIGNATION' }),
        );
      }
    } catch (err) {
      this.logger.error(
        `[notifyCeoExitInterviewDone] failed for request ${params.requestId}: ${(err as any)?.message}`,
      );
    }
  }

  async notifyFirstApprover(params: { requestId: string; requestType: string; employeeId: string }) {
    try {
      const requestTypeLabels: Record<string, string> = {
        RESIGNATION: 'استقالة', TRANSFER: 'نقل', BUSINESS_MISSION: 'مهمة عمل',
        DELEGATION: 'تفويض', HIRING_REQUEST: 'طلب توظيف', COMPLAINT: 'شكوى',
        REMOTE_WORK: 'عمل عن بعد', OVERTIME_MANAGER: 'عمل إضافي',
        WORK_ACCIDENT: 'حادث عمل', OTHER: 'أخرى',
      };
      const label = requestTypeLabels[params.requestType] ?? 'طلب إداري';

      // المدير المباشر للموظف
      const mgr = await this.prisma.$queryRaw<Array<{ userId: string | null }>>`
        SELECT e2."userId"
        FROM users.employees e
        JOIN users.employees e2 ON e2.id = e."managerId"
        WHERE e.id = ${params.employeeId} AND e."deletedAt" IS NULL
        LIMIT 1
      `;
      if (mgr[0]?.userId) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2::"users"."NotificationType", $3, $4, $5, $6, $7::jsonb, NOW())`,
          mgr[0].userId,
          'GENERAL',
          `طلب ${label} بانتظار موافقتك`,
          'Request Awaiting Your Approval',
          `تم تقديم طلب ${label} وهو بانتظار موافقتك كمدير مباشر`,
          'A request is awaiting your approval as direct manager',
          JSON.stringify({ requestId: params.requestId, requestType: params.requestType }),
        );
      }
    } catch (err) {
      this.logger.error(`[notifyFirstApprover] failed for request ${params.requestId}: ${(err as any)?.message}`);
    }
  }

  async notifyNextApprover(params: {
    requestId: string;
    requestType: string;
    nextRole: string;
    employeeId: string;
    requestDetails?: any;
  }) {
    try {
      const requestTypeLabels: Record<string, string> = {
        RESIGNATION: 'استقالة', TRANSFER: 'نقل', BUSINESS_MISSION: 'مهمة عمل',
        DELEGATION: 'تفويض', HIRING_REQUEST: 'طلب توظيف', COMPLAINT: 'شكوى',
        REMOTE_WORK: 'عمل عن بعد', OVERTIME_MANAGER: 'عمل إضافي',
        WORK_ACCIDENT: 'حادث عمل', OTHER: 'أخرى',
      };
      const label = requestTypeLabels[params.requestType] ?? 'طلب إداري';
      const roleLabels: Record<string, string> = {
        TARGET_MANAGER: 'مدير القسم المستهدف',
        HR: 'HR',
        CEO: 'المدير التنفيذي',
        CFO: 'المدير المالي',
        DIRECT_MANAGER: 'المدير المباشر',
      };
      const roleLabel = roleLabels[params.nextRole] ?? params.nextRole;

      let userIds: string[] = [];

      if (params.nextRole === 'TARGET_MANAGER') {
        const newDeptId = params.requestDetails?.newDepartmentId;
        if (!newDeptId) return;
        const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string | null }>>(
          `SELECT e."userId" FROM users.departments d
           JOIN users.employees e ON e.id = d."managerId"
           WHERE d.id = $1 AND d."deletedAt" IS NULL AND e."deletedAt" IS NULL LIMIT 1`,
          newDeptId,
        );
        if (rows[0]?.userId) userIds = [rows[0].userId];
      } else if (params.nextRole === 'DIRECT_MANAGER') {
        const rows = await this.prisma.$queryRaw<Array<{ userId: string | null }>>`
          SELECT e2."userId" FROM users.employees e
          JOIN users.employees e2 ON e2.id = e."managerId"
          WHERE e.id = ${params.employeeId} AND e."deletedAt" IS NULL LIMIT 1
        `;
        if (rows[0]?.userId) userIds = [rows[0].userId];
      } else {
        const permMap: Record<string, string> = {
          HR: 'requests:hr-approve',
          CEO: 'requests:ceo-approve',
          CFO: 'requests:cfo-approve',
        };
        const perm = permMap[params.nextRole];
        if (!perm) return;
        // عند إشعار HR: نستثني من عنده صلاحية CEO لتجنب إشعار مزدوج
        const excludeCeo = params.nextRole === 'HR'
          ? `AND u.id NOT IN (
               SELECT DISTINCT ur2."userId" FROM users.user_roles ur2
               JOIN users.role_permissions rp2 ON rp2."roleId" = ur2."roleId"
               JOIN users.permissions p2 ON p2.id = rp2."permissionId"
               WHERE p2.name = 'requests:ceo-approve'
             )`
          : '';
        const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
          `SELECT DISTINCT u.id as "userId" FROM users.users u
           JOIN users.user_roles ur ON ur."userId" = u.id
           JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
           JOIN users.permissions p ON p.id = rp."permissionId"
           WHERE p.name = $1 AND u."deletedAt" IS NULL ${excludeCeo}`,
          perm,
        );
        userIds = rows.map(r => r.userId);
      }

      for (const userId of userIds) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2::"users"."NotificationType", $3, $4, $5, $6, $7::jsonb, NOW())`,
          userId,
          'GENERAL',
          `طلب ${label} بانتظار موافقتك`,
          'Request Awaiting Your Approval',
          `وصل طلب ${label} إلى مرحلة ${roleLabel} وهو بانتظار موافقتك`,
          `A ${label} request has reached the ${roleLabel} stage and awaits your approval`,
          JSON.stringify({ requestId: params.requestId, requestType: params.requestType }),
        );
      }
    } catch (err) {
      this.logger.error(`[notifyNextApprover] failed for request ${params.requestId}: ${(err as any)?.message}`);
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
