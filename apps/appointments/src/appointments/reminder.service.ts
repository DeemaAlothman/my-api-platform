import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cron from 'node-cron';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReminderService implements OnModuleInit {
  private readonly logger = new Logger(ReminderService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Run at 09:00 every day
    cron.schedule('0 9 * * *', () => { this.sendDayBeforeReminders().catch(() => {}); });
    this.logger.log('Appointment reminder cron registered (09:00 daily)');
  }

  async sendDayBeforeReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        startTime: { gte: tomorrow, lt: dayAfter },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        reminderSentAt: null,
      },
    });

    if (appointments.length === 0) return;

    this.logger.log(`Sending reminders for ${appointments.length} appointments tomorrow`);

    const mailUrl   = process.env.MAIL_SERVICE_URL   || 'http://mail:4005';
    const token     = process.env.INTERNAL_SERVICE_TOKEN || '';

    for (const appt of appointments) {
      try {
        await fetch(`${mailUrl}/api/v1/mail/internal/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': token },
          body: JSON.stringify({
            to:      appt.patientId,
            subject: 'تذكير بموعدك غداً',
            body:    `لديك موعد غداً في تمام الساعة ${new Date(appt.startTime).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}. الرجاء الحضور في الوقت المحدد.`,
            type:    'APPOINTMENT_REMINDER',
          }),
        });

        await this.prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSentAt: new Date(), reminderChannel: 'MAIL' as any },
        });
      } catch (e: any) {
        this.logger.warn(`Failed to send reminder for appointment ${appt.id}: ${e.message}`);
      }
    }

    this.logger.log(`Reminder cron complete — processed ${appointments.length} appointments`);
  }
}
