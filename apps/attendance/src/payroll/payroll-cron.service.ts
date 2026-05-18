import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PayrollService } from './payroll.service';

@Injectable()
export class PayrollCronService implements OnModuleInit {
  private readonly logger = new Logger(PayrollCronService.name);

  constructor(private readonly payrollService: PayrollService) {}

  onModuleInit() {
    this.scheduleNextRun();
  }

  private getNextRunDate(): Date {
    const now = new Date();
    // آخر يوم في الشهر الحالي الساعة 23:00 UTC = 2:00 صباحاً دمشق (UTC+3) في اليوم الأول من الشهر التالي
    const candidate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 0, 0, 0),
    );
    if (candidate.getTime() <= now.getTime()) {
      // فات الوقت هذا الشهر، جدوله للشهر القادم
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 0, 0, 0),
      );
    }
    return candidate;
  }

  private scheduleNextRun() {
    const next = this.getNextRunDate();
    const delayMs = next.getTime() - Date.now();

    this.logger.log(
      `Payroll auto-generate scheduled in ${Math.round(delayMs / 60000)} minutes (at ${next.toISOString()})`,
    );

    setTimeout(async () => {
      const year = next.getUTCFullYear();
      const month = next.getUTCMonth() + 1; // الشهر المراد توليد رواتبه

      this.logger.log(`Auto-generating payroll for ${year}/${month}`);
      try {
        const result = await this.payrollService.generate({ year, month });
        this.logger.log(`Payroll auto-generate done: ${JSON.stringify(result)}`);
      } catch (err) {
        this.logger.error(`Payroll auto-generate failed: ${(err as any)?.message}`);
      }
      this.scheduleNextRun();
    }, delayMs);
  }
}
