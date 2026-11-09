import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetRewardDto, SetWinnerImageDto } from './dto/reward.dto';

const DEFAULT_CASH_AMOUNT = 50; // حسب المواصفة — 50$، قابل للتخصيص لو انبعت amount مختلف
const MONTH_NAMES_AR = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getWinner(year: number, month: number, company: string) {
    const cycle = await this.prisma.cycle.findUnique({ where: { year_month: { year, month } } });
    if (!cycle) throw new NotFoundException({ code: 'CYCLE_NOT_FOUND', message: 'لا توجد دورة لهذا الشهر' });
    if (cycle.status !== 'CLOSED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الدورة لازم تكون مغلقة ومحسومة أولاً' });
    }
    const winner = await this.prisma.candidate.findFirst({ where: { cycleId: cycle.id, company, isWinner: true } });
    if (!winner) throw new BadRequestException({ code: 'NO_WINNER_YET', message: 'ما في فائز محسوم بعد لهذه الشركة — ممكن بانتظار حسم تعادل' });
    return { cycle, winner };
  }

  async setReward(year: number, month: number, dto: SetRewardDto, userId: string) {
    const { winner } = await this.getWinner(year, month, dto.company);
    if (winner.rewardedAt) {
      throw new BadRequestException({ code: 'ALREADY_REWARDED', message: 'تم تحديد مكافأة لهذا الفائز مسبقاً' });
    }

    const monthLabel = `نجم الشهر — ${MONTH_NAMES_AR[month - 1]} ${year}`;

    if (dto.rewardType === 'CASH') {
      const amount = dto.amount ?? DEFAULT_CASH_AMOUNT;
      const effectiveDate = new Date(Date.UTC(year, month - 1, 1));
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO users.employee_rewards_penalties
           (id, "employeeId", kind, category, amount, "typeCode", reason, "issuedBy", status, "effectiveDate", "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'REWARD', 'MATERIAL', $2, 'STAR_OF_MONTH', $3, $5, 'ACTIVE', $4, NOW())`,
        winner.employeeId, amount, monthLabel, effectiveDate, userId,
      );
      return this.prisma.candidate.update({
        where: { id: winner.id },
        data: { rewardType: 'CASH', rewardAmount: amount, rewardedAt: new Date() },
      });
    }

    // PAID_LEAVE — عدد الأيام إجباري (ما في سياسة ثابتة بعد)
    if (!dto.days || dto.days <= 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم تحدّدي عدد أيام الإجازة المكافأة' });
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO leaves.leave_balances
         (id, "employeeId", "leaveTypeId", year, "totalDays", "usedDays", "pendingDays", "remainingDays",
          "carriedOverDays", "adjustmentDays", "adjustmentReason", "usedHours", "pendingHours", "createdAt", "updatedAt")
       SELECT gen_random_uuid()::text, $1, lt.id, $2, 0, 0, 0, $3, 0, $3, $4, 0, 0, NOW(), NOW()
       FROM leaves.leave_types lt WHERE lt.code = 'ANNUAL'
       ON CONFLICT ("employeeId", "leaveTypeId", "year")
       DO UPDATE SET
         "adjustmentDays" = leaves.leave_balances."adjustmentDays" + $3,
         "remainingDays" = leaves.leave_balances."remainingDays" + $3,
         "adjustmentReason" = COALESCE(leaves.leave_balances."adjustmentReason" || '؛ ', '') || $4,
         "updatedAt" = NOW()`,
      winner.employeeId, year, dto.days, monthLabel,
    );
    return this.prisma.candidate.update({
      where: { id: winner.id },
      data: { rewardType: 'PAID_LEAVE', rewardLeaveDays: dto.days, rewardedAt: new Date() },
    });
  }

  async setWinnerImage(year: number, month: number, dto: SetWinnerImageDto) {
    const { winner } = await this.getWinner(year, month, dto.company);
    return this.prisma.candidate.update({ where: { id: winner.id }, data: { imageUrl: dto.imageUrl } });
  }

  // نجوم الشهر الحالية للواجهة الرئيسية — آخر دورة مغلقة فيها فائزون محسومون (كل الشركات)
  async getCurrent() {
    const cycle = await this.prisma.cycle.findFirst({
      where: { status: 'CLOSED' },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    if (!cycle) return { cycle: null, winners: [] };

    const winners = await this.prisma.candidate.findMany({ where: { cycleId: cycle.id, isWinner: true } });
    return {
      cycle: { year: cycle.year, month: cycle.month },
      winners: winners.map((w) => ({
        company: w.company,
        employeeId: w.employeeId,
        imageUrl: w.imageUrl,
        title: `نجم الشهر — ${MONTH_NAMES_AR[cycle.month - 1]} ${cycle.year}`,
        finalScore: w.finalScore,
      })),
    };
  }
}
