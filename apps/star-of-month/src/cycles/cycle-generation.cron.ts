import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CyclesService } from './cycles.service';

@Injectable()
export class CycleGenerationCron {
  private readonly logger = new Logger(CycleGenerationCron.name);

  constructor(private readonly cycles: CyclesService) {}

  // يوم 1 من كل شهر الساعة 1 صباحاً — يولّد قائمة الشهر يلي خلص (الشهر الحالي ناقص واحد)
  @Cron('0 1 1 * *', { timeZone: 'Asia/Damascus' })
  async generatePreviousMonthCycle() {
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    try {
      await this.cycles.generateCycle(year, month);
      this.logger.log(`Star of the month cycle generated for ${year}-${month}`);
    } catch (err) {
      this.logger.error(`generatePreviousMonthCycle failed for ${year}-${month}: ${(err as any)?.message}`);
    }
  }
}
