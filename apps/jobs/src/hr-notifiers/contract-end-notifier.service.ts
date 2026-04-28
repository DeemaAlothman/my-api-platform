import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const THRESHOLDS = [30, 14, 7];

@Injectable()
export class ContractEndNotifierService implements OnModuleInit {
  private readonly logger = new Logger(ContractEndNotifierService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.scheduleDaily();
  }

  private scheduleDaily() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(5, 15, 0, 0); // 8:15am Damascus = 5:15am UTC (offset from probation notifier)
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    setTimeout(async () => {
      try { await this.run(); } catch (err) {
        this.logger.error(`ContractEndNotifier failed: ${(err as any)?.message}`);
      }
      this.scheduleDaily();
    }, next.getTime() - now.getTime());
  }

  async run() {
    for (const days of THRESHOLDS) {
      await this.checkContractEnding(days);
    }
  }

  private async checkContractEnding(daysAhead: number) {
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + daysAhead);
    const targetStr = targetDate.toISOString().split('T')[0];

    const employees = await this.prisma.$queryRawUnsafe(`
      SELECT e.id, e."firstNameAr", e."lastNameAr", e."employeeNumber", e."contractEndDate"
      FROM users.employees e
      WHERE e."deletedAt" IS NULL
        AND e."employmentStatus" = 'ACTIVE'
        AND e."contractEndDate" IS NOT NULL
        AND e."contractEndDate"::date = $1::date
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
            (gen_random_uuid(), $1, 'CONTRACT_EXPIRY',
             'تنبيه انتهاء العقد', 'Contract Expiry Alert',
             $2, $3, false, NOW())
        `,
          hrUserId,
          `ينتهي عقد الموظف ${emp.firstNameAr} ${emp.lastNameAr} (${emp.employeeNumber}) خلال ${daysAhead} يوم`,
          `Employee ${emp.firstNameAr} ${emp.lastNameAr} contract expires in ${daysAhead} days`,
        );
      }
    }

    this.logger.log(`ContractEndNotifier: ${employees.length} contract(s) ending in ${daysAhead} days`);
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
