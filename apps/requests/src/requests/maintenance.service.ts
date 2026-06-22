import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalResolverService } from './approval-resolver.service';
import { CreateMaintenanceDto, LogisticsDecisionDto, RepairOption } from './dto/maintenance.dto';

/**
 * طلب الصيانة — مسار معزول تماماً عن باقي أنواع الطلبات.
 * المسار: مقدّم الطلب → المدير المباشر → المسؤول اللوجستي → (حسب الخيار) → المدير التنفيذي → الموظف المكلَّف → DONE
 */
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ApprovalResolverService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async empId(userId: string): Promise<string> {
    const id = await this.resolver.getEmployeeIdByUserId(userId);
    if (!id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'No employee record for this user', details: [] });
    }
    return id;
  }

  private async getMaintenance(id: string): Promise<any> {
    const req = await this.prisma.request.findFirst({
      where: { id, type: 'MAINTENANCE' as any, deletedAt: null },
    });
    if (!req) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Maintenance request not found', details: [] });
    return req;
  }

  private async generateNumber(): Promise<string> {
    const last = await this.prisma.request.findFirst({
      where: { requestNumber: { startsWith: 'VTX-MNT-' } },
      orderBy: { requestNumber: 'desc' },
      select: { requestNumber: true },
    });
    const n = last ? parseInt(last.requestNumber.replace('VTX-MNT-', ''), 10) : 0;
    return `VTX-MNT-${String(n + 1).padStart(6, '0')}`;
  }

  private async addHistory(requestId: string, action: string, fromStatus: string | null, toStatus: string, performedBy: string, notes?: string) {
    await this.prisma.requestHistory.create({
      data: { requestId, action, fromStatus: fromStatus ?? undefined, toStatus, performedBy, notes: notes ?? undefined },
    });
  }

  private async employeeExists(employeeId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ ok: number }>>`
      SELECT 1 AS ok FROM users.employees WHERE id = ${employeeId} AND "deletedAt" IS NULL LIMIT 1
    `;
    return rows.length > 0;
  }

  // هل المدير المباشر لمقدّم الطلب هو نفسه المدير التنفيذي؟ (لتفادي إرسال الطلب له مرتين)
  private async isManagerCeo(employeeId: string): Promise<boolean> {
    const mgrRows = await this.prisma.$queryRaw<Array<{ managerId: string | null }>>`
      SELECT "managerId" FROM users.employees WHERE id = ${employeeId} AND "deletedAt" IS NULL LIMIT 1
    `;
    const managerId = mgrRows[0]?.managerId;
    if (!managerId) return false;
    const c = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM users.user_roles ur
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      JOIN users.employees e ON e."userId" = ur."userId"
      WHERE e.id = ${managerId} AND p.name = 'requests:ceo-approve' AND e."deletedAt" IS NULL
    `;
    return Number(c[0]?.count ?? 0) > 0;
  }

  private async insertNotif(userId: string, requestId: string, titleAr: string, messageAr: string) {
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
      userId, titleAr, messageAr, JSON.stringify({ requestId, requestType: 'MAINTENANCE' }),
    ).catch(() => { /* الإشعار لا يكسر العملية */ });
  }

  private async notifyEmployee(employeeId: string, requestId: string, titleAr: string, messageAr: string) {
    const rows = await this.prisma.$queryRaw<Array<{ userId: string | null }>>`
      SELECT "userId" FROM users.employees WHERE id = ${employeeId} AND "userId" IS NOT NULL AND "deletedAt" IS NULL LIMIT 1
    `;
    const userId = rows[0]?.userId;
    if (userId) await this.insertNotif(userId, requestId, titleAr, messageAr);
  }

  private async notifyManagerOf(employeeId: string, requestId: string, titleAr: string, messageAr: string) {
    const rows = await this.prisma.$queryRaw<Array<{ managerId: string | null }>>`
      SELECT "managerId" FROM users.employees WHERE id = ${employeeId} AND "deletedAt" IS NULL LIMIT 1
    `;
    const managerId = rows[0]?.managerId;
    if (managerId) await this.notifyEmployee(managerId, requestId, titleAr, messageAr);
  }

  private async notifyRole(permissionName: string, requestId: string, titleAr: string, messageAr: string) {
    const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT DISTINCT u.id AS "userId"
      FROM users.users u
      JOIN users.user_roles ur ON ur."userId" = u.id
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      WHERE p.name = ${permissionName} AND u.status = 'ACTIVE'
    `;
    for (const r of rows) await this.insertNotif(r.userId, requestId, titleAr, messageAr);
  }

  // ── Flow ───────────────────────────────────────────────────────────────────

  // 1) أي موظف يقدّم طلب صيانة → PENDING_MANAGER
  async create(dto: CreateMaintenanceDto, userId: string) {
    const employeeId = await this.empId(userId);
    const details = {
      workLocation: dto.workLocation,
      assetType: dto.assetType,
      assetNumber: dto.assetNumber ?? null,
      brandModel: dto.brandModel ?? null,
      faultDescription: dto.faultDescription,
      priority: dto.priority,
    };

    for (let attempt = 0; attempt < 5; attempt++) {
      const requestNumber = await this.generateNumber();
      try {
        const req = await this.prisma.request.create({
          data: {
            requestNumber,
            employeeId,
            type: 'MAINTENANCE' as any,
            status: 'PENDING_MANAGER' as any,
            details,
          },
        });
        await this.addHistory(req.id, 'SUBMIT', null, 'PENDING_MANAGER', employeeId, 'تقديم طلب صيانة');
        await this.notifyManagerOf(employeeId, req.id, 'طلب صيانة جديد', 'لديك طلب صيانة بانتظار موافقتك');
        return req;
      } catch (err: any) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('requestNumber')) continue;
        throw err;
      }
    }
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'فشل توليد رقم الطلب', details: [] });
  }

  // 2) المدير المباشر يوافق → PENDING_LOGISTICS
  async managerApprove(id: string, userId: string, approve: boolean, notes?: string) {
    const req = await this.getMaintenance(id);
    if (req.status !== 'PENDING_MANAGER') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الطلب ليس بانتظار موافقة المدير', details: [] });
    }
    const canApprove = await this.resolver.canApprove(userId, req.employeeId, 'DIRECT_MANAGER');
    if (!canApprove) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'لست المدير المباشر لمقدّم الطلب', details: [] });
    }
    if (!approve) return this.doReject(req, userId, 'MANAGER', notes);

    const details = { ...(req.details as any), managerApprovedBy: userId, managerApprovedAt: new Date().toISOString() };
    await this.prisma.request.update({ where: { id }, data: { status: 'PENDING_LOGISTICS' as any, details } });
    await this.addHistory(id, 'MANAGER_APPROVE', 'PENDING_MANAGER', 'PENDING_LOGISTICS', userId, notes);
    await this.notifyRole('requests:lo-approve', id, 'طلب صيانة بانتظار اللوجستي', 'طلب صيانة بانتظار قرار المسؤول اللوجستي');
    return this.getMaintenance(id);
  }

  // 3) المسؤول اللوجستي: توصيف الحالة + اختيار الخيار + تعيين الموظف
  async logisticsDecision(id: string, userId: string, dto: LogisticsDecisionDto) {
    const req = await this.getMaintenance(id);
    if (req.status !== 'PENDING_LOGISTICS') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الطلب ليس بانتظار المسؤول اللوجستي', details: [] });
    }
    if (!(await this.employeeExists(dto.assignedEmployeeId))) {
      throw new BadRequestException({ code: 'RESOURCE_NOT_FOUND', message: 'الموظف المعيَّن غير موجود', details: [{ field: 'assignedEmployeeId' }] });
    }

    const baseDetails = {
      ...(req.details as any),
      situationDescription: dto.situationDescription ?? null,
      repairOption: dto.repairOption,
      amount: dto.amount ?? null,
      logisticsBy: userId,
      logisticsAt: new Date().toISOString(),
    };

    // الخيار الأول: إصلاح داخلي → يُعيَّن الموظف مباشرة
    if (dto.repairOption === RepairOption.INTERNAL) {
      const details = { ...baseDetails, assignedAt: new Date().toISOString() };
      await this.prisma.request.update({
        where: { id },
        data: { status: 'ASSIGNED' as any, targetEmployeeId: dto.assignedEmployeeId, details },
      });
      await this.addHistory(id, 'LOGISTICS_INTERNAL', 'PENDING_LOGISTICS', 'ASSIGNED', userId, dto.situationDescription);
      await this.notifyEmployee(dto.assignedEmployeeId, id, 'مهمة صيانة جديدة', 'تم تكليفك بمهمة صيانة');
      return this.getMaintenance(id);
    }

    // الخياران 2/3: بحاجة قطع خارجية / ورشة خارجية → موافقة المدير التنفيذي
    // معالجة الدمج: إذا المدير المباشر هو نفسه المدير التنفيذي، نتخطّى خطوة التنفيذي
    const skipExecutive = await this.isManagerCeo(req.employeeId);
    if (skipExecutive) {
      const details = { ...baseDetails, executiveSkipped: true, assignedAt: new Date().toISOString() };
      await this.prisma.request.update({
        where: { id },
        data: { status: 'ASSIGNED' as any, targetEmployeeId: dto.assignedEmployeeId, details },
      });
      await this.addHistory(id, 'LOGISTICS_EXTERNAL_AUTO', 'PENDING_LOGISTICS', 'ASSIGNED', userId, dto.situationDescription);
      await this.notifyRole('requests:cfo-approve', id, 'طلب صيانة (قطع/ورشة)', 'طلب صيانة بحاجة قطع/ورشة — اعتُمد تلقائياً (المدير المباشر هو المدير التنفيذي)');
      await this.notifyEmployee(dto.assignedEmployeeId, id, 'مهمة صيانة جديدة', 'تم تكليفك بمهمة صيانة');
      return this.getMaintenance(id);
    }

    await this.prisma.request.update({
      where: { id },
      data: { status: 'PENDING_EXECUTIVE' as any, targetEmployeeId: dto.assignedEmployeeId, details: baseDetails },
    });
    await this.addHistory(id, 'LOGISTICS_EXTERNAL', 'PENDING_LOGISTICS', 'PENDING_EXECUTIVE', userId, dto.situationDescription);
    await this.notifyRole('requests:ceo-approve', id, 'طلب صيانة بانتظار التنفيذي', 'طلب صيانة بانتظار موافقة المدير التنفيذي');
    return this.getMaintenance(id);
  }

  // 4) المدير التنفيذي يوافق → إشعار CFO + ASSIGNED
  async executiveApprove(id: string, userId: string, approve: boolean, notes?: string) {
    const req = await this.getMaintenance(id);
    if (req.status !== 'PENDING_EXECUTIVE') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الطلب ليس بانتظار المدير التنفيذي', details: [] });
    }
    const isCeo = await this.resolver.hasPermission(userId, 'requests:ceo-approve');
    if (!isCeo) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'لست المدير التنفيذي', details: [] });
    }
    if (!approve) return this.doReject(req, userId, 'EXECUTIVE', notes);

    const details = { ...(req.details as any), executiveApprovedBy: userId, executiveApprovedAt: new Date().toISOString(), assignedAt: new Date().toISOString() };
    await this.prisma.request.update({ where: { id }, data: { status: 'ASSIGNED' as any, details } });
    await this.addHistory(id, 'EXECUTIVE_APPROVE', 'PENDING_EXECUTIVE', 'ASSIGNED', userId, notes);
    await this.notifyRole('requests:cfo-approve', id, 'موافقة المدير التنفيذي', 'وافق المدير التنفيذي على طلب صيانة (قطع/ورشة)');
    if (req.targetEmployeeId) await this.notifyEmployee(req.targetEmployeeId, id, 'مهمة صيانة جديدة', 'تم تكليفك بمهمة صيانة');
    return this.getMaintenance(id);
  }

  // 5) الموظف المكلَّف ينفّذ → DONE
  async complete(id: string, userId: string) {
    const req = await this.getMaintenance(id);
    if (req.status !== 'ASSIGNED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الطلب ليس قيد التنفيذ', details: [] });
    }
    const employeeId = await this.empId(userId);
    if (req.targetEmployeeId !== employeeId) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'هذه المهمة ليست معيَّنة لك', details: [] });
    }
    const details = { ...(req.details as any), executedAt: new Date().toISOString() };
    await this.prisma.request.update({ where: { id }, data: { status: 'DONE' as any, details } });
    await this.addHistory(id, 'COMPLETED', 'ASSIGNED', 'DONE', employeeId, 'تم تنفيذ المهمة');
    await this.notifyEmployee(req.employeeId, id, 'تم تنفيذ طلب الصيانة', 'تم إنجاز طلب الصيانة الخاص بك');
    return this.getMaintenance(id);
  }

  async reject(id: string, userId: string, notes?: string) {
    const req = await this.getMaintenance(id);
    if (!['PENDING_MANAGER', 'PENDING_EXECUTIVE'].includes(req.status)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكن رفض الطلب في حالته الحالية', details: [] });
    }
    // التحقق من صلاحية الرافض حسب المرحلة
    if (req.status === 'PENDING_MANAGER') {
      const can = await this.resolver.canApprove(userId, req.employeeId, 'DIRECT_MANAGER');
      if (!can) throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'لست المدير المباشر', details: [] });
      return this.doReject(req, userId, 'MANAGER', notes);
    }
    const isCeo = await this.resolver.hasPermission(userId, 'requests:ceo-approve');
    if (!isCeo) throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'لست المدير التنفيذي', details: [] });
    return this.doReject(req, userId, 'EXECUTIVE', notes);
  }

  private async doReject(req: any, userId: string, by: string, notes?: string) {
    const details = { ...(req.details as any), rejectedBy: by, rejectedByUser: userId, rejectedAt: new Date().toISOString(), rejectNotes: notes ?? null };
    await this.prisma.request.update({ where: { id: req.id }, data: { status: 'REJECTED' as any, details } });
    await this.addHistory(req.id, 'REJECT', req.status, 'REJECTED', userId, notes);
    await this.notifyEmployee(req.employeeId, req.id, 'تم رفض طلب الصيانة', notes || 'تم رفض طلب الصيانة الخاص بك');
    return this.getMaintenance(req.id);
  }

  // مهام الصيانة المعيَّنة على الموظف الحالي
  async myTasks(userId: string) {
    const employeeId = await this.empId(userId);
    return this.prisma.request.findMany({
      where: { type: 'MAINTENANCE' as any, targetEmployeeId: employeeId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}
