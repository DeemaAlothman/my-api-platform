import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { HR_NOTIFICATION_ROLES } from '@shared/constants/roles.constants';

@Injectable()
export class ProbationReminderService {
  private readonly logger = new Logger(ProbationReminderService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 8 * * *', { timeZone: 'Asia/Riyadh' })
  async sendProbationReminders() {
    this.logger.log('Running probation end reminders check...');

    for (const daysAhead of [14, 7]) {
      await this.notifyForDays(daysAhead);
    }
  }

  private async notifyForDays(daysAhead: number) {
    const employees = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        e.id,
        e."employeeNumber",
        CONCAT(e."firstNameAr", ' ', e."lastNameAr") AS "fullNameAr",
        CASE
          WHEN e."probationPeriod" = 'ONE_MONTH'    THEN (e."hireDate" + INTERVAL '1 month')::date
          WHEN e."probationPeriod" = 'TWO_MONTHS'   THEN (e."hireDate" + INTERVAL '2 months')::date
          WHEN e."probationPeriod" = 'THREE_MONTHS' THEN (e."hireDate" + INTERVAL '3 months')::date
        END AS "probationEndDate"
      FROM users.employees e
      WHERE e."deletedAt" IS NULL
        AND e."employmentStatus" = 'ACTIVE'
        AND e."probationResult" IS NULL
        AND e."probationPeriod" IN ('ONE_MONTH', 'TWO_MONTHS', 'THREE_MONTHS')
        AND NOT EXISTS (
          SELECT 1 FROM evaluation."ProbationEvaluation" pe WHERE pe."employeeId" = e.id
        )
        AND (
          (e."probationPeriod" = 'ONE_MONTH'    AND (e."hireDate" + INTERVAL '1 month')::date    = CURRENT_DATE + INTERVAL '${daysAhead} days')
          OR (e."probationPeriod" = 'TWO_MONTHS'   AND (e."hireDate" + INTERVAL '2 months')::date   = CURRENT_DATE + INTERVAL '${daysAhead} days')
          OR (e."probationPeriod" = 'THREE_MONTHS' AND (e."hireDate" + INTERVAL '3 months')::date = CURRENT_DATE + INTERVAL '${daysAhead} days')
        )
    `);

    if (employees.length === 0) return;

    const hrUsers = await this.prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT DISTINCT ur."userId"
      FROM users.user_roles ur
      INNER JOIN users.roles r ON ur."roleId" = r.id
      WHERE r.name = ANY(${HR_NOTIFICATION_ROLES}::text[])
        AND r."deletedAt" IS NULL
    `;

    if (hrUsers.length === 0) return;

    const labelAr = daysAhead === 7 ? '7 أيام' : '14 يوماً';

    for (const emp of employees) {
      const endDate = emp.probationEndDate
        ? new Date(emp.probationEndDate).toLocaleDateString('ar-SA')
        : '';

      for (const hr of hrUsers) {
        await this.prisma.notification.create({
          data: {
            userId: hr.userId,
            type: 'PROBATION_END_REMINDER',
            titleAr: `تذكير: تقييم فترة التجربة`,
            titleEn: `Probation Evaluation Reminder`,
            messageAr: `تنتهي فترة تجربة الموظف ${emp.fullNameAr} (${emp.employeeNumber}) بعد ${labelAr} بتاريخ ${endDate}، ولم يُبدأ التقييم بعد.`,
            messageEn: `Employee ${emp.fullNameAr} (${emp.employeeNumber}) probation ends in ${daysAhead} days on ${endDate}. No evaluation has been started yet.`,
            data: {
              employeeId: emp.id,
              employeeNumber: emp.employeeNumber,
              probationEndDate: emp.probationEndDate,
              daysRemaining: daysAhead,
            },
          },
        });
      }
    }

    this.logger.log(`Probation reminders sent for ${employees.length} employee(s) ending in ${daysAhead} days`);
  }
}
