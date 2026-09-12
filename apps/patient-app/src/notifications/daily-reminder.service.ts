import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cron from 'node-cron';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const REMINDER_TEXT_AR = 'حان وقت متابعة تمارينك العلاجية. افتح التطبيق وأكمل برنامجك اليوم.';
const REMINDER_TEXT_EN = "It's time to continue your physiotherapy exercises. Open the app and complete today's program.";

// تذكير يومي 3 مرات (بند 10-أ بالتوصيف): 09:00, 15:00, 20:00 — بتوقيت السيرفر (Asia/Riyadh حسب باقي المنصة)
@Injectable()
export class DailyReminderService implements OnModuleInit {
  private readonly logger = new Logger(DailyReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    cron.schedule('0 9 * * *', () => this.sendDailyReminders().catch(() => {}));
    cron.schedule('0 15 * * *', () => this.sendDailyReminders().catch(() => {}));
    cron.schedule('0 20 * * *', () => this.sendDailyReminders().catch(() => {}));
    this.logger.log('Daily exercise reminder cron registered (09:00, 15:00, 20:00)');
  }

  async sendDailyReminders() {
    // فقط المرضى اللي عندهم تمارين فعّالة (مش أي حساب — تجنّب إشعار من لا برنامج عنده)
    const accounts = await this.prisma.patientAccount.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        erpPatientId: {
          in: (
            await this.prisma.sessionExerciseAssignment.findMany({
              where: { status: 'ACTIVE' },
              select: { erpPatientId: true },
              distinct: ['erpPatientId'],
            })
          ).map((a) => a.erpPatientId),
        },
      },
    });

    if (accounts.length === 0) return;
    this.logger.log(`Sending daily reminders to ${accounts.length} patient(s)`);

    for (const account of accounts) {
      await this.notifications
        .notify(account.id, account.erpPatientId, 'DAILY_REMINDER', 'تذكير بالتمارين', 'Exercise Reminder', REMINDER_TEXT_AR, REMINDER_TEXT_EN)
        .catch((e) => this.logger.warn(`Failed to notify account ${account.id}: ${e.message}`));
    }
  }
}
