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

    // خدمةُ البريد تستمع على 4009، وكان المكتوبُ هنا 4005. وهذه الخدمةُ لا تُعرَّف
    // لها MAIL_SERVICE_URL في إعداد التشغيل فيُستعمل هذا الافتراضُ وحدَه — فكان
    // النداءُ يُوجَّه إلى بابٍ لا أحدَ وراءه، ولم يَصل تذكيرُ موعدٍ واحدٍ قطُّ.
    const mailUrl   = process.env.MAIL_SERVICE_URL   || 'http://mail:4009';
    const token     = process.env.INTERNAL_SERVICE_TOKEN || '';

    for (const appt of appointments) {
      try {
        const res = await fetch(`${mailUrl}/api/v1/mail/internal/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': token },
          body: JSON.stringify({
            to:      appt.patientId,
            subject: 'تذكير بموعدك غداً',
            body:    `لديك موعد غداً في تمام الساعة ${new Date(appt.startTime).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}. الرجاء الحضور في الوقت المحدد.`,
            type:    'APPOINTMENT_REMINDER',
          }),
        });

        // fetch لا ترمي إلا إذا تعذَّر الوصولُ أصلاً: ردٌّ بخطأٍ من خدمة البريد
        // كان يُحسَب نجاحاً فيُختَم الموعدُ بأن تذكيرَه أُرسِل، ولم يُرسَل.
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`mail ${res.status}: ${body.slice(0, 200)}`);
        }

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
