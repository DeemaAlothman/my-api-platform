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
             e."firstNameAr", e."lastNameAr", e."employeeNumber", e."gender"
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

    // جلب مستخدمي HR (صلاحية leave_requests:approve_hr) مع استثناء المدير التنفيذي (دور CEO/CEOO)
    const hrUsers = await this.prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT DISTINCT ur."userId"
      FROM users.user_roles ur
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      WHERE p.name = 'leave_requests:approve_hr'
        AND ur."userId" NOT IN (
          SELECT ur2."userId"
          FROM users.user_roles ur2
          JOIN users.roles r2 ON r2.id = ur2."roleId"
          WHERE r2.name IN ('CEO', 'CEOO')
        )
    `;

    if (hrUsers.length === 0) {
      this.logger.warn('No HR users found for medical leave notifications');
      return;
    }

    for (const req of pendingRequests) {
      const employeeName = `${req.firstNameAr} ${req.lastNameAr}`;
      // الضمير حسب جنس الموظف: مديرها (أنثى) / مديره (ذكر)
      const managerWord = req.gender === 'FEMALE' ? 'مديرها المباشر' : 'مديره المباشر';
      const messageAr = `يوجد طلب إجازة طبية للموظف ${employeeName} (${req.employeeNumber}) في انتظار موافقة ${managerWord} منذ أكثر من 48 ساعة`;
      const messageEn = `There is a medical leave request for employee ${employeeName} (${req.employeeNumber}) awaiting their direct manager's approval for more than 48 hours`;
      // رابط التفاصيل: الفرونت يفتح الطلب عبر leaveRequestId (GET /leave-requests/:id)
      const data = JSON.stringify({ leaveRequestId: req.id });

      // إرسال إشعار لكل مستخدم HR (المدير التنفيذي مُستثنى)
      for (const hr of hrUsers) {
        await this.prisma.$queryRawUnsafe(`
          INSERT INTO users.notifications ("id", "userId", "type", "titleAr", "titleEn", "messageAr", "messageEn", "data", "isRead", "createdAt")
          VALUES (gen_random_uuid(), $1, 'GENERAL',
            'تنبيه',
            'Alert',
            $2,
            $3,
            $4::jsonb,
            false, NOW())
        `,
          hr.userId,
          messageAr,
          messageEn,
          data,
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
