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

  // كل ساعة — يغلق أي دورة صار وقتها المحدَّد (votingClosesAt) وبعدها بمرحلة VOTING، وقبلها
  // بيذكّر من لم يصوّت بعد (24-25 ساعة قبل الإغلاق، مرة وحدة بس لكل دورة)
  @Cron('0 * * * *', { timeZone: 'Asia/Damascus' })
  async closeDueCycles() {
    const now = new Date();

    const due = await this.prisma.cycle.findMany({
      where: { status: 'VOTING', votingClosesAt: { lte: now } },
    });
    for (const cycle of due) {
      try {
        await this.votes.closeVoting(cycle.year, cycle.month);
        this.logger.log(`Star of the month cycle closed: ${cycle.year}-${cycle.month}`);
      } catch (err) {
        this.logger.error(`closeDueCycles failed for ${cycle.year}-${cycle.month}: ${(err as any)?.message}`);
      }
    }

    const reminderDue = await this.prisma.cycle.findMany({
      where: {
        status: 'VOTING',
        voteReminderSentAt: null,
        votingClosesAt: { gt: now, lte: new Date(now.getTime() + 25 * 60 * 60 * 1000) },
      },
    });
    for (const cycle of reminderDue) {
      try {
        await this.votes.sendVoteReminderIfDue(cycle.year, cycle.month);
        this.logger.log(`Star of the month vote reminder sent: ${cycle.year}-${cycle.month}`);
      } catch (err) {
        this.logger.error(`sendVoteReminderIfDue failed for ${cycle.year}-${cycle.month}: ${(err as any)?.message}`);
      }
    }
  }
}
