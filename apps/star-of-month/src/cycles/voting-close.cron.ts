import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { VotesService } from './votes.service';

@Injectable()
export class VotingCloseCron {
  private readonly logger = new Logger(VotingCloseCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly votes: VotesService,
  ) {}

  // كل ساعة — يغلق أي دورة صار وقتها المحدَّد (votingClosesAt) وبعدها بمرحلة VOTING
  @Cron('0 * * * *', { timeZone: 'Asia/Damascus' })
  async closeDueCycles() {
    const due = await this.prisma.cycle.findMany({
      where: { status: 'VOTING', votingClosesAt: { lte: new Date() } },
    });
    for (const cycle of due) {
      try {
        await this.votes.closeVoting(cycle.year, cycle.month);
        this.logger.log(`Star of the month cycle closed: ${cycle.year}-${cycle.month}`);
      } catch (err) {
        this.logger.error(`closeDueCycles failed for ${cycle.year}-${cycle.month}: ${(err as any)?.message}`);
      }
    }
  }
}
