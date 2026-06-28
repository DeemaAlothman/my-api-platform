import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FIXED_EMPLOYEE_ID = '6a888f6f-4158-4da1-b528-eb013b63876d';

@Injectable()
export class EmergencyService {
  constructor(private readonly prisma: PrismaService) {}

  private async insertNotif(userId: string, alertId: string, titleAr: string, messageAr: string) {
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
      userId, titleAr, messageAr, JSON.stringify({ alertId, alertType: 'PHYSIO_EMERGENCY' }),
    ).catch(() => {});
  }

  private async getUserIdByEmployeeId(employeeId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ userId: string | null }>>`
      SELECT "userId" FROM users.employees WHERE id = ${employeeId} AND "deletedAt" IS NULL LIMIT 1
    `;
    return rows[0]?.userId ?? null;
  }

  // إرسال تنبيه طارئ → يصل للموظف الثابت
  async sendAlert(sentByUserId: string, senderNote?: string) {
    const alert = await this.prisma.physioEmergencyAlert.create({
      data: { sentByUserId, senderNote: senderNote ?? null },
    });

    const targetUserId = await this.getUserIdByEmployeeId(FIXED_EMPLOYEE_ID);
    if (targetUserId) {
      const message = senderNote
        ? `هناك حالة طارئة: ${senderNote}`
        : 'هناك حالة طارئة تستدعي تدخلك الفوري';
      await this.insertNotif(targetUserId, alert.id, 'حالة طارئة', message);
    }

    return alert;
  }

  // الموظف الثابت يرد بملاحظة → إشعار يرجع للمُرسِل
  async respond(alertId: string, respondingUserId: string, note: string) {
    const respondingEmployeeId = await this.getEmployeeIdByUserId(respondingUserId);
    if (respondingEmployeeId !== FIXED_EMPLOYEE_ID) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'غير مصرح لك بالرد على هذا التنبيه', details: [] });
    }

    const alert = await this.prisma.physioEmergencyAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'التنبيه غير موجود', details: [] });

    const updated = await this.prisma.physioEmergencyAlert.update({
      where: { id: alertId },
      data: { note, status: 'RESPONDED', respondedAt: new Date() },
    });

    await this.insertNotif(alert.sentByUserId, alertId, 'رد على التنبيه الطارئ', `ملاحظة: ${note}`);

    return updated;
  }

  // قائمة التنبيهات للموظف الثابت
  async listForFixed(userId: string) {
    const employeeId = await this.getEmployeeIdByUserId(userId);
    if (employeeId !== FIXED_EMPLOYEE_ID) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'غير مصرح لك', details: [] });
    }
    return this.prisma.physioEmergencyAlert.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // تنبيهاتي التي أرسلتها
  async myAlerts(userId: string) {
    return this.prisma.physioEmergencyAlert.findMany({
      where: { sentByUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getEmployeeIdByUserId(userId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users.employees WHERE "userId" = ${userId} AND "deletedAt" IS NULL LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }
}
