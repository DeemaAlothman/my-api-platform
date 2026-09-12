import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushSenderService } from './push-sender.service';

type NotificationType =
  | 'DAILY_REMINDER'
  | 'PROGRAM_ASSIGNED'
  | 'PROGRAM_UPDATED'
  | 'PROGRAM_CANCELLED'
  | 'PROGRAM_REORDERED'
  | 'APPOINTMENT_CREATED';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushSender: PushSenderService,
  ) {}

  async registerDevice(patientAccountId: string, token: string, platform: 'IOS' | 'ANDROID' | 'WEB') {
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: { patientAccountId, platform },
      create: { patientAccountId, token, platform },
    });
  }

  // نقطة دخول موحّدة لإنشاء إشعار — تُستدعى داخلياً من نفس الخدمة (تعديل برنامج) أو من خدمات أخرى (مواعيد)
  async notifyByErpPatientId(
    erpPatientId: string,
    type: NotificationType,
    titleAr: string,
    titleEn: string,
    bodyAr: string,
    bodyEn: string,
    payload?: Record<string, unknown>,
  ) {
    const account = await this.prisma.patientAccount.findFirst({
      where: { erpPatientId, status: 'ACTIVE', deletedAt: null },
    });
    if (!account) return null; // لا يوجد حساب تطبيق فعّال لهذا المريض — لا شيء لإشعاره
    return this.notify(account.id, erpPatientId, type, titleAr, titleEn, bodyAr, bodyEn, payload);
  }

  async notify(
    patientAccountId: string,
    erpPatientId: string,
    type: NotificationType,
    titleAr: string,
    titleEn: string,
    bodyAr: string,
    bodyEn: string,
    payload?: Record<string, unknown>,
  ) {
    const devices = await this.prisma.deviceToken.findMany({ where: { patientAccountId } });
    const delivered = await this.pushSender.send(
      devices.map((d) => d.token),
      titleAr,
      bodyAr,
    );

    return this.prisma.notificationLog.create({
      data: {
        patientAccountId,
        erpPatientId,
        type: type as any,
        titleAr,
        titleEn,
        bodyAr,
        bodyEn,
        payloadJson: payload as any,
        pushAttempted: devices.length > 0,
        pushDelivered: delivered,
      },
    });
  }

  async listForPatient(patientAccountId: string) {
    return this.prisma.notificationLog.findMany({
      where: { patientAccountId },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
  }

  async markRead(patientAccountId: string, id: string) {
    const notif = await this.prisma.notificationLog.findFirst({ where: { id, patientAccountId } });
    if (!notif) return null;
    if (notif.readAt) return notif;
    return this.prisma.notificationLog.update({ where: { id }, data: { readAt: new Date() } });
  }
}
