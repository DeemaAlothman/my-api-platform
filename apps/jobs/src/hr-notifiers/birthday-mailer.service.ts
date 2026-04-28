import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BirthdayMailerService implements OnModuleInit {
  private readonly logger = new Logger(BirthdayMailerService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.scheduleDaily();
  }

  private scheduleDaily() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(5, 30, 0, 0); // 8:30am Damascus = 5:30am UTC
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    setTimeout(async () => {
      try { await this.run(); } catch (err) {
        this.logger.error(`BirthdayMailer failed: ${(err as any)?.message}`);
      }
      this.scheduleDaily();
    }, next.getTime() - now.getTime());
  }

  async run() {
    const today = new Date();
    const month = today.getUTCMonth() + 1;
    const day = today.getUTCDate();

    const employees = await this.prisma.$queryRawUnsafe(`
      SELECT e.id, e."firstNameAr", e."lastNameAr", e."userId"
      FROM users.employees e
      WHERE e."deletedAt" IS NULL
        AND e."employmentStatus" = 'ACTIVE'
        AND e."dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM e."dateOfBirth") = $1
        AND EXTRACT(DAY FROM e."dateOfBirth") = $2
        AND e."userId" IS NOT NULL
    `, month, day) as any[];

    for (const emp of employees) {
      await this.sendBirthdayMail(emp.userId, emp.firstNameAr).catch(err =>
        this.logger.error(`Birthday mail failed for userId=${emp.userId}: ${err.message}`),
      );
    }

    if (employees.length > 0) {
      this.logger.log(`BirthdayMailer: sent to ${employees.length} employee(s)`);
    }
  }

  private async sendBirthdayMail(userId: string, firstName: string) {
    const MAIL_URL = process.env.MAIL_SERVICE_URL || 'http://localhost:4007';
    const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

    const res = await fetch(`${MAIL_URL}/api/v1/mail/internal/system-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': TOKEN },
      body: JSON.stringify({
        recipientUserId: userId,
        subject: 'كل عام وأنت بخير',
        body: `عزيزي/عزيزتي ${firstName}،\n\nنتمنى لك يوم ميلاد سعيداً ومليئاً بالفرح والنجاحات.\n\nفريق الموارد البشرية`,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  }
}
