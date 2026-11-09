import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CastVoteDto, TieBreakDto } from './dto/vote.dto';

const VOTING_DURATION_DAYS = 3;
const MONTH_NAMES_AR = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];

@Injectable()
export class VotesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCycleOrThrow(year: number, month: number) {
    const cycle = await this.prisma.cycle.findUnique({ where: { year_month: { year, month } }, include: { candidates: true } });
    if (!cycle) throw new NotFoundException({ code: 'CYCLE_NOT_FOUND', message: 'لا توجد دورة لهذا الشهر' });
    return cycle;
  }

  // إشعار كل الموظفين النشطين (userId موجود) — "فتح التصويت" و"إعلان الفائز"
  private async notifyAllActiveEmployees(titleAr: string, messageAr: string, data: Record<string, unknown>) {
    try {
      const users = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT DISTINCT e."userId" FROM users.employees e
         WHERE e."employmentStatus" = 'ACTIVE' AND e."deletedAt" IS NULL AND e."userId" IS NOT NULL`,
      );
      for (const { userId } of users) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "data", "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'GENERAL', $2, $2, $3, $3, false, $4::jsonb, NOW())`,
          userId, titleAr, messageAr, JSON.stringify(data),
        ).catch(() => {});
      }
    } catch {
      // الإشعار لا يكسر العملية
    }
  }

  // إشعار حاملي صلاحية معيّنة — "طلب حسم تعادل" للمدير التنفيذي
  private async notifyPermissionHolders(permissionName: string, titleAr: string, messageAr: string, data: Record<string, unknown>) {
    try {
      const users = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT DISTINCT ur."userId"
         FROM users.user_roles ur
         JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
         JOIN users.permissions p ON p.id = rp."permissionId"
         WHERE p.name = $1`,
        permissionName,
      );
      for (const { userId } of users) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "data", "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'GENERAL', $2, $2, $3, $3, false, $4::jsonb, NOW())`,
          userId, titleAr, messageAr, JSON.stringify(data),
        ).catch(() => {});
      }
    } catch {
      // الإشعار لا يكسر العملية
    }
  }

  // تذكير لمن لم يصوّت بعد (صوت الزميل تحديداً) — قبل الإغلاق بيوم
  private async notifyNonVoters(cycleId: string, company: string) {
    try {
      const nonVoters = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT e."userId" FROM users.employees e
         WHERE e.company = $1 AND e."employmentStatus" = 'ACTIVE' AND e."deletedAt" IS NULL AND e."userId" IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM star_of_month.votes v
             WHERE v."cycleId" = $2 AND v.company = $1 AND v."voterEmployeeId" = e.id AND v."voterRole" = 'PEER'
           )`,
        company, cycleId,
      );
      for (const { userId } of nonVoters) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "data", "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'GENERAL', $2, $2, $3, $3, false, $4::jsonb, NOW())`,
          userId,
          'تذكير — التصويت لنجم الشهر ينتهي غداً',
          'لم تصوّتي/تصوّت بعد لنجم الشهر — التصويت ينتهي خلال 24 ساعة',
          JSON.stringify({ type: 'STAR_OF_MONTH_VOTE_REMINDER' }),
        ).catch(() => {});
      }
    } catch {
      // الإشعار لا يكسر العملية
    }
  }

  private async recordWinnerHistory(employeeId: string, year: number, month: number) {
    try {
      const title = `نجم الشهر — ${MONTH_NAMES_AR[month - 1]} ${year}`;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO users.employee_history_events (id, "employeeId", "eventType", note, "effectiveDate", "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'STAR_OF_MONTH', $2, $3, NOW())`,
        employeeId, title, new Date(Date.UTC(year, month - 1, 1)),
      );
    } catch {
      // السجل لا يكسر العملية
    }
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
    const updated = await this.prisma.cycle.update({
      where: { id: cycle.id },
      data: { status: 'VOTING', votingOpensAt, votingClosesAt },
    });
    await this.notifyAllActiveEmployees(
      'فتح التصويت لنجم الشهر',
      `صار فيكي تصوّتي لنجم الشهر (${MONTH_NAMES_AR[month - 1]} ${year}) — التصويت مفتوح 3 أيام`,
      { type: 'STAR_OF_MONTH_VOTING_OPENED', year, month },
    );
    return updated;
  }

  // تذكير لمن لم يصوّت بعد — تُستدعى من cron قبل الإغلاق بيوم، مرة وحدة بس لكل دورة
  async sendVoteReminderIfDue(year: number, month: number) {
    const cycle = await this.getCycleOrThrow(year, month);
    if (cycle.status !== 'VOTING' || cycle.voteReminderSentAt) return;
    const companies = [...new Set(cycle.candidates.map((c) => c.company))];
    for (const company of companies) {
      await this.notifyNonVoters(cycle.id, company);
    }
    await this.prisma.cycle.update({ where: { id: cycle.id }, data: { voteReminderSentAt: new Date() } });
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
    const outcomes: Array<{ company: string; winnerEmployeeId: string | null; isTie: boolean }> = [];

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
        const winners = computed.filter((c) => c.finalScore === maxScore);
        const isTie = winners.length > 1;

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

        outcomes.push({ company, winnerEmployeeId: isTie ? null : winners[0].employeeId, isTie });
      }

      await tx.cycle.update({ where: { id: cycle.id }, data: { status: 'CLOSED', closedAt: new Date() } });
    });

    // إشعارات + سجل الإضبارة — بعد تثبيت الإغلاق، مش جوا المعاملة
    for (const o of outcomes) {
      if (o.winnerEmployeeId) {
        await this.recordWinnerHistory(o.winnerEmployeeId, year, month);
        await this.notifyAllActiveEmployees(
          'فائز نجم الشهر',
          `مبروك لفائز نجم الشهر (${MONTH_NAMES_AR[month - 1]} ${year}) بشركة ${o.company}!`,
          { type: 'STAR_OF_MONTH_WINNER', year, month, company: o.company },
        );
      } else {
        await this.notifyPermissionHolders(
          'star_of_month.ceo_vote',
          'تعادل بنتيجة نجم الشهر — بانتظار حسمك',
          `في تعادل بالصدارة لقائمة شركة ${o.company} (${MONTH_NAMES_AR[month - 1]} ${year}) — محتاج تحسمه`,
          { type: 'STAR_OF_MONTH_TIE_BREAK_NEEDED', year, month, company: o.company },
        );
      }
    }

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

    const updated = await this.prisma.candidate.update({ where: { id: chosen.id }, data: { isWinner: true, wasTieBroken: true } });
    await this.recordWinnerHistory(chosen.employeeId, year, month);
    await this.notifyAllActiveEmployees(
      'فائز نجم الشهر',
      `مبروك لفائز نجم الشهر (${MONTH_NAMES_AR[month - 1]} ${year}) بشركة ${dto.company}!`,
      { type: 'STAR_OF_MONTH_WINNER', year, month, company: dto.company },
    );
    return updated;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
