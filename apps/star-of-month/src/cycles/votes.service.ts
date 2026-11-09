import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CastVoteDto, TieBreakDto } from './dto/vote.dto';

const VOTING_DURATION_DAYS = 3;

@Injectable()
export class VotesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCycleOrThrow(year: number, month: number) {
    const cycle = await this.prisma.cycle.findUnique({ where: { year_month: { year, month } }, include: { candidates: true } });
    if (!cycle) throw new NotFoundException({ code: 'CYCLE_NOT_FOUND', message: 'لا توجد دورة لهذا الشهر' });
    return cycle;
  }

  private async resolveVoter(userId: string): Promise<{ employeeId: string; company: string | null }> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; company: string | null }>>(
      `SELECT id, company FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      userId,
    );
    if (!rows.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يوجد سجل موظف مرتبط بهذا الحساب' });
    return { employeeId: rows[0].id, company: rows[0].company };
  }

  async openVoting(year: number, month: number) {
    const cycle = await this.getCycleOrThrow(year, month);
    if (cycle.status !== 'NOMINATING') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'ما يمكن فتح التصويت — الدورة ليست بمرحلة الترشيح' });
    }
    const votingOpensAt = new Date();
    const votingClosesAt = new Date(votingOpensAt.getTime() + VOTING_DURATION_DAYS * 24 * 60 * 60 * 1000);
    return this.prisma.cycle.update({
      where: { id: cycle.id },
      data: { status: 'VOTING', votingOpensAt, votingClosesAt },
    });
  }

  // تصويت موحَّد للأدوار الثلاثة — الزميل لازم يكون من نفس شركة القائمة، المدير/التنفيذي لأ
  // (بيشرفوا على الشركتين). صوت واحد بس بكل دور لكل قائمة شركة (unique constraint بالجدول)
  private async castVote(year: number, month: number, dto: CastVoteDto, userId: string, role: 'PEER' | 'MANAGER' | 'CEO') {
    const cycle = await this.getCycleOrThrow(year, month);
    if (cycle.status !== 'VOTING') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'التصويت مغلق حالياً' });
    }
    const candidate = cycle.candidates.find((c) => c.company === dto.company && c.employeeId === dto.candidateId);
    if (!candidate) throw new NotFoundException({ code: 'CANDIDATE_NOT_FOUND', message: 'المرشح غير موجود بهذه القائمة' });

    const voter = await this.resolveVoter(userId);
    if (voter.employeeId === dto.candidateId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكنك التصويت لنفسك' });
    }
    if (role === 'PEER' && voter.company !== dto.company) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'يمكنك التصويت فقط بقائمة شركتك' });
    }

    try {
      await this.prisma.vote.create({
        data: {
          cycleId: cycle.id,
          company: dto.company,
          voterEmployeeId: voter.employeeId,
          candidateEmployeeId: dto.candidateId,
          voterRole: role as any,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException({ code: 'ALREADY_VOTED', message: 'لقد صوّتّ مسبقاً بهذا الدور لهذه القائمة' });
      }
      throw err;
    }
    return { success: true };
  }

  votePeer(year: number, month: number, dto: CastVoteDto, userId: string) {
    return this.castVote(year, month, dto, userId, 'PEER');
  }
  voteManager(year: number, month: number, dto: CastVoteDto, userId: string) {
    return this.castVote(year, month, dto, userId, 'MANAGER');
  }
  voteCeo(year: number, month: number, dto: CastVoteDto, userId: string) {
    return this.castVote(year, month, dto, userId, 'CEO');
  }

  // يكشف تصويت صاحبه فقط — لا أحد تاني يقدر يشوفه (السرية)
  async getMyVotes(year: number, month: number, userId: string) {
    const cycle = await this.getCycleOrThrow(year, month);
    const voter = await this.resolveVoter(userId);
    const votes = await this.prisma.vote.findMany({ where: { cycleId: cycle.id, voterEmployeeId: voter.employeeId } });
    return votes.map((v) => ({ company: v.company, voterRole: v.voterRole, candidateId: v.candidateEmployeeId, votedAt: v.createdAt }));
  }

  // إغلاق التصويت — يحسب نتائج كل شركة ويجمّدها. لو في تعادل بالصدارة، ما يُحدَّد فائز
  // تلقائياً (isWinner يضل false للمتعادلين) لحد ما يحسمه المدير التنفيذي عبر tie-break
  async closeVoting(year: number, month: number) {
    const cycle = await this.getCycleOrThrow(year, month);
    if (cycle.status !== 'VOTING') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'ما يمكن الإغلاق — الدورة ليست بمرحلة التصويت' });
    }

    const companies = [...new Set(cycle.candidates.map((c) => c.company))];

    await this.prisma.$transaction(async (tx) => {
      for (const company of companies) {
        const candidates = cycle.candidates.filter((c) => c.company === company);

        const peerVotes = await tx.vote.groupBy({
          by: ['candidateEmployeeId'],
          where: { cycleId: cycle.id, company, voterRole: 'PEER' },
          _count: { id: true },
        });
        const peerCountMap = new Map(peerVotes.map((v) => [v.candidateEmployeeId, v._count.id]));
        const totalPeerVotes = peerVotes.reduce((s, v) => s + v._count.id, 0);

        const managerVotes = await tx.vote.findMany({ where: { cycleId: cycle.id, company, voterRole: 'MANAGER' } });
        const managerWinnerIds = new Set(managerVotes.map((v) => v.candidateEmployeeId));

        const ceoVotes = await tx.vote.findMany({ where: { cycleId: cycle.id, company, voterRole: 'CEO' } });
        const ceoWinnerIds = new Set(ceoVotes.map((v) => v.candidateEmployeeId));

        const computed = candidates.map((c) => {
          const peerCount = peerCountMap.get(c.employeeId) ?? 0;
          const peerVoteScore = totalPeerVotes > 0 ? this.round((peerCount / totalPeerVotes) * 40) : 0;
          const managerVoteReceived = managerWinnerIds.has(c.employeeId);
          const managerVoteScore = managerVoteReceived ? 10 : 0;
          const ceoVoteReceived = ceoWinnerIds.has(c.employeeId);
          const ceoVoteScore = ceoVoteReceived ? 20 : 0;
          const voteScoreSum = peerVoteScore + managerVoteScore + ceoVoteScore; // من 70

          // مرشح HR: ما بيخضع للنقاط التلقائية — نتيجته من التصويت بس، مرفوعة لـ100
          const finalScore = c.source === 'HR'
            ? this.round((voteScoreSum / 70) * 100)
            : this.round(Number(c.autoScoreTotal ?? 0) + voteScoreSum);

          return { id: c.id, employeeId: c.employeeId, peerCount, peerVoteScore, managerVoteReceived, managerVoteScore, ceoVoteReceived, ceoVoteScore, finalScore };
        });

        const maxScore = Math.max(...computed.map((c) => c.finalScore));
        const winnersCount = computed.filter((c) => c.finalScore === maxScore).length;
        const isTie = winnersCount > 1;

        for (const c of computed) {
          await tx.candidate.update({
            where: { id: c.id },
            data: {
              peerVoteCount: c.peerCount,
              peerVoteScore: c.peerVoteScore,
              managerVoteReceived: c.managerVoteReceived,
              managerVoteScore: c.managerVoteScore,
              ceoVoteReceived: c.ceoVoteReceived,
              ceoVoteScore: c.ceoVoteScore,
              finalScore: c.finalScore,
              isWinner: !isTie && c.finalScore === maxScore,
            },
          });
        }
      }

      await tx.cycle.update({ where: { id: cycle.id }, data: { status: 'CLOSED', closedAt: new Date() } });
    });

    return this.getCycleOrThrow(year, month);
  }

  // حسم تعادل المدير التنفيذي — بس لما الدورة مغلقة وفعلياً في تعادل بالصدارة لهاي الشركة
  async tieBreak(year: number, month: number, dto: TieBreakDto) {
    const cycle = await this.getCycleOrThrow(year, month);
    if (cycle.status !== 'CLOSED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الدورة لازم تكون مغلقة قبل حسم التعادل' });
    }

    const companyCandidates = cycle.candidates.filter((c) => c.company === dto.company);
    if (companyCandidates.some((c) => c.isWinner)) {
      throw new BadRequestException({ code: 'NO_TIE', message: 'لا يوجد تعادل بهذه القائمة — الفائز محسوم أصلاً' });
    }

    const maxScore = Math.max(...companyCandidates.map((c) => Number(c.finalScore ?? 0)));
    const tied = companyCandidates.filter((c) => Number(c.finalScore ?? 0) === maxScore);
    const chosen = tied.find((c) => c.employeeId === dto.employeeId);
    if (!chosen) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الموظف المختار ليس من ضمن المتعادلين الفعليين' });
    }

    return this.prisma.candidate.update({ where: { id: chosen.id }, data: { isWinner: true, wasTieBroken: true } });
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
