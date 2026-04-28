import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAIL_URL = () => process.env.MAIL_SERVICE_URL || 'http://localhost:4007';
const INTERNAL_TOKEN = () => process.env.INTERNAL_SERVICE_TOKEN || '';
const THRESHOLDS = [30, 14, 7];

@Injectable()
export class ProbationEndNotifierService implements OnModuleInit {
  private readonly logger = new Logger(ProbationEndNotifierService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.scheduleDaily();
  }

  private scheduleDaily() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(5, 0, 0, 0); // 8am Damascus = 5am UTC
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    setTimeout(async () => {
      try { await this.run(); } catch (err) {
        this.logger.error(`ProbationEndNotifier failed: ${(err as any)?.message}`);
      }
      this.scheduleDaily();
    }, next.getTime() - now.getTime());
  }

  async run() {
    for (const days of THRESHOLDS) {
      await this.checkProbationEnding(days);
    }
  }

  private async checkProbationEnding(daysAhead: number) {
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + daysAhead);
    const targetStr = targetDate.toISOString().split('T')[0];

    const employees = await this.prisma.$queryRawUnsafe(`
      SELECT e.id, e."firstNameAr", e."lastNameAr", e."employeeNumber",
             e."hireDate", e."probationPeriod"
      FROM users.employees e
      WHERE e."deletedAt" IS NULL
        AND e."employmentStatus" = 'ACTIVE'
        AND e."probationResult" IS NULL
        AND e."probationPeriod" IN ('ONE_MONTH','TWO_MONTHS','THREE_MONTHS')
        AND (
          (e."probationPeriod" = 'ONE_MONTH'
            AND (e."hireDate" + INTERVAL '1 month')::date = $1::date)
          OR (e."probationPeriod" = 'TWO_MONTHS'
            AND (e."hireDate" + INTERVAL '2 months')::date = $1::date)
          OR (e."probationPeriod" = 'THREE_MONTHS'
            AND (e."hireDate" + INTERVAL '3 months')::date = $1::date)
        )
    `, targetStr) as any[];

    if (employees.length === 0) return;

    const hrUserIds = await this.getHRUserIds();
    if (hrUserIds.length === 0) return;

    for (const emp of employees) {
      for (const hrUserId of hrUserIds) {
        await this.prisma.$queryRawUnsafe(`
          INSERT INTO users.notifications
            (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
          VALUES
            (gen_random_uuid(), $1, 'PROBATION_END_REMINDER',
             'تنبيه انتهاء فترة التجربة', 'Probation Period Ending Soon',
             $2, $3, false, NOW())
        `,
          hrUserId,
          `تنتهي فترة تجربة الموظف ${emp.firstNameAr} ${emp.lastNameAr} (${emp.employeeNumber}) خلال ${daysAhead} يوم`,
          `Employee ${emp.firstNameAr} ${emp.lastNameAr} probation ends in ${daysAhead} days`,
        );
      }
    }

    this.logger.log(`ProbationEndNotifier: ${employees.length} employee(s) ending in ${daysAhead} days notified to ${hrUserIds.length} HR users`);
  }

  private async getHRUserIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe(`
      SELECT DISTINCT u.id
      FROM users.users u
      INNER JOIN users.user_roles ur ON ur."userId" = u.id
      INNER JOIN users.roles r ON r.id = ur."roleId"
      WHERE r.name IN ('hr_manager', 'super_admin')
        AND u."deletedAt" IS NULL
    `) as any[];
    return rows.map(r => r.id);
  }
}
