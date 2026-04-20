import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MedicalLeaveNotifierService {
  private readonly logger = new Logger(MedicalLeaveNotifierService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async notifyHrForPendingMedicalLeaves() {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // جلب طلبات الإجازة الطبية التي تجاوزت 48 ساعة بدون موافقة ولم يُرسل إشعار بعد
    const pendingRequests = await this.prisma.$queryRaw<any[]>`
      SELECT lr.id, lr."employeeId", lr."createdAt",
             lt.code AS "leaveTypeCode",
             e."firstNameAr", e."lastNameAr", e."employeeNumber"
      FROM leaves.leave_requests lr
      JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
      JOIN users.employees e ON e.id = lr."employeeId"
      WHERE lr.status = 'PENDING_MANAGER'
        AND lr."hrNotifiedAt" IS NULL
        AND lr."createdAt" < ${cutoff}
        AND lr."deletedAt" IS NULL
        AND (lt.code ILIKE '%SICK%' OR lt.code ILIKE '%MED%' OR lt.code ILIKE '%MEDICAL%')
    `;

    if (pendingRequests.length === 0) return;

    // جلب كل مستخدمين لديهم صلاحية leave_requests:approve_hr
    const hrUsers = await this.prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT DISTINCT ur."userId"
      FROM users.user_roles ur
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      WHERE p.name = 'leave_requests:approve_hr'
    `;

    if (hrUsers.length === 0) {
      this.logger.warn('No HR users found for medical leave notifications');
      return;
    }

    for (const req of pendingRequests) {
      const employeeName = `${req.firstNameAr} ${req.lastNameAr}`;

      // إرسال إشعار لكل مستخدم HR
      for (const hr of hrUsers) {
        await this.prisma.$queryRawUnsafe(`
          INSERT INTO users.notifications ("id", "userId", "type", "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
          VALUES (gen_random_uuid(), $1, 'GENERAL',
            'طلب إجازة طبية معلق',
            'Pending Medical Leave Request',
            $2,
            $3,
            false, NOW())
        `,
          hr.userId,
          `طلب إجازة طبية للموظف ${employeeName} (${req.employeeNumber}) في انتظار الموافقة منذ أكثر من 48 ساعة`,
          `Medical leave request for employee ${employeeName} (${req.employeeNumber}) has been pending for more than 48 hours`,
        );
      }

      // تحديث hrNotifiedAt لتجنب إرسال الإشعار مرتين
      await this.prisma.$queryRawUnsafe(
        `UPDATE leaves.leave_requests SET "hrNotifiedAt" = NOW() WHERE id = $1`,
        req.id,
      );

      this.logger.log(`HR notified for medical leave request ${req.id} (${employeeName})`);
    }
  }
}
