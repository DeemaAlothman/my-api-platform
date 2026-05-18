import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      SELECT
        e.id,
        e."firstNameAr",
        e."lastNameAr",
        e."employeeNumber",
        e."hireDate",
        e."probationPeriod",
        e."userId"             AS "employeeUserId",
        mgr."userId"           AS "managerUserId"
      FROM users.employees e
      LEFT JOIN users.employees mgr ON mgr.id = e."managerId" AND mgr."deletedAt" IS NULL
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

    for (const emp of employees) {
      const name = `${emp.firstNameAr} ${emp.lastNameAr} (${emp.employeeNumber})`;

      // HR notifications (existing behaviour)
      for (const hrUserId of hrUserIds) {
        await this.insertNotification(
          hrUserId,
          'PROBATION_END_REMINDER',
          'تنبيه انتهاية فترة التجربة',
          'Probation Period Ending Soon',
          `تنتهي فترة تجربة الموظف ${name} خلال ${daysAhead} يوم`,
          `Employee ${name} probation ends in ${daysAhead} days`,
        );
      }

      // Notify the employee themselves
      if (emp.employeeUserId) {
        await this.insertNotification(
          emp.employeeUserId,
          'PROBATION_END_REMINDER',
          'اقتربت نهاية فترة تجربتك',
          'Your Probation Period is Ending Soon',
          `تنتهي فترة تجربتك خلال ${daysAhead} يوم`,
          `Your probation period ends in ${daysAhead} days`,
        );
      }

      // Notify the direct manager
      if (emp.managerUserId) {
        await this.insertNotification(
          emp.managerUserId,
          'PROBATION_END_REMINDER',
          'تنتهي فترة تجربة موظفك',
          'Your Employee Probation Ending Soon',
          `تنتهي فترة تجربة الموظف ${name} خلال ${daysAhead} يوم`,
          `Employee ${name} probation ends in ${daysAhead} days`,
        );
      }
    }

    this.logger.log(`ProbationEndNotifier: ${employees.length} employee(s) ending in ${daysAhead} days — notifications sent`);
  }

  private async insertNotification(
    userId: string,
    type: string,
    titleAr: string,
    titleEn: string,
    messageAr: string,
    messageEn: string,
  ) {
    await this.prisma.$queryRawUnsafe(`
      INSERT INTO users.notifications
        (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
      VALUES
        (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW())
    `, userId, type, titleAr, titleEn, messageAr, messageEn);
  }

  private async getHRUserIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe(`
      SELECT DISTINCT u.id
      FROM users.users u
      INNER JOIN users.user_roles ur ON ur."userId" = u.id
      INNER JOIN users.roles r ON r.id = ur."roleId"
      WHERE r.name IN ('HR', 'HR_Specialist', 'super_admin')
        AND r."deletedAt" IS NULL
        AND u."deletedAt" IS NULL
    `) as any[];
    return rows.map(r => r.id);
  }
}
