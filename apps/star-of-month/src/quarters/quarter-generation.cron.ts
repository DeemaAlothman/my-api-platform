import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QuartersService, quarterOf } from './quarters.service';

@Injectable()
export class QuarterGenerationCron {
  private readonly logger = new Logger(QuarterGenerationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quarters: QuartersService,
  ) {}

  // يومياً — يفحص أي ربع (سنة/ربع/شركة) خلصت أشهره الثلاثة (دوراتها مغلقة وفائزها محسوم)
  // وما تحسب لسا، ويحسب نجم الربع له (الحساب نفسه مؤجَّل تلقائياً لو شهر بالربع لسا مش جاهز)
  @Cron('0 3 * * *', { timeZone: 'Asia/Damascus' })
  async checkDueQuarters() {
    const closedCycles = await this.prisma.cycle.findMany({
      where: { status: 'CLOSED' },
      include: { candidates: true },
    });

    const combos = new Map<string, { year: number; quarter: number; company: string }>();
    for (const cycle of closedCycles) {
      const quarter = quarterOf(cycle.month);
      for (const company of new Set(cycle.candidates.map((c) => c.company))) {
        combos.set(`${cycle.year}-${quarter}-${company}`, { year: cycle.year, quarter, company });
      }
    }

    for (const { year, quarter, company } of combos.values()) {
      const existing = await this.prisma.quarterWinner.findUnique({
        where: { year_quarter_company: { year, quarter, company } },
      });
      if (existing) continue;

      try {
        await this.quarters.computeQuarter(year, quarter, company);
        this.logger.log(`Quarter winner computed: ${year} Q${quarter} ${company}`);
      } catch {
        // الربع لسا مش جاهز (دورة مفتوحة أو تعادل شهري معلّق) — بيعاد الفحص باليوم التالي
      }
    }
  }
}
