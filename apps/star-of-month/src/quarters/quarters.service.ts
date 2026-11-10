import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateService } from './certificate.service';

const QUARTER_NAMES_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع'];

export function quarterOf(month: number): number {
  return Math.ceil(month / 3);
}

export function monthsOfQuarter(quarter: number): number[] {
  return [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3];
}

@Injectable()
export class QuartersService {
  private readonly logger = new Logger(QuartersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificateService,
  ) {}

  // إشعار حاملي صلاحية معيّنة — نفس نمط votes.service (تعادل بانتظار الحسم)
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

  // إشعار الموظف الفائز نفسه بالربع
  private async notifyEmployee(employeeId: string, titleAr: string, messageAr: string, data: Record<string, unknown>) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string | null }>>(
        `SELECT "userId" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
        employeeId,
      );
      if (!rows.length || !rows[0].userId) return;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "data", "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'GENERAL', $2, $2, $3, $3, false, $4::jsonb, NOW())`,
        rows[0].userId, titleAr, messageAr, JSON.stringify(data),
      ).catch(() => {});
    } catch {
      // الإشعار لا يكسر العملية
    }
  }

  private async getOrThrow(year: number, quarter: number, company: string) {
    const row = await this.prisma.quarterWinner.findUnique({
      where: { year_quarter_company: { year, quarter, company } },
    });
    if (!row) throw new NotFoundException({ code: 'QUARTER_WINNER_NOT_FOUND', message: 'لا يوجد سجل لهذا الربع بعد' });
    return row;
  }

  // الفائزين الشهريين الثلاثة لهاد الربع/الشركة — لازم تكون الدورات الثلاثة مغلقة
  // والفائز محسوم (بدون تعادل شهري معلّق) قبل ما نحسب نجم الربع
  private async getMonthlyWinners(year: number, quarter: number, company: string) {
    const months = monthsOfQuarter(quarter);
    const cycles = await this.prisma.cycle.findMany({ where: { year, month: { in: months } } });
    if (cycles.length < months.length || cycles.some((c) => c.status !== 'CLOSED')) {
      return null; // الربع لسا ما خلص
    }
    const winners = await this.prisma.candidate.findMany({
      where: { company, cycleId: { in: cycles.map((c) => c.id) }, isWinner: true },
    });
    if (winners.length < months.length) {
      return null; // في شهر لسا فائزه غير محسوم (تعادل شهري بانتظار الحسم)
    }
    return winners;
  }

  // حساب نجم الربع — يُستدعى من الـcron يومياً، ومتاح يدوياً كمان لإعادة المحاولة
  async computeQuarter(year: number, quarter: number, company: string) {
    const existing = await this.prisma.quarterWinner.findUnique({
      where: { year_quarter_company: { year, quarter, company } },
    });
    if (existing) return existing;

    const winners = await this.getMonthlyWinners(year, quarter, company);
    if (!winners) {
      throw new BadRequestException({ code: 'QUARTER_NOT_READY', message: 'الربع لسا ما خلص — لازم الثلاث دورات الشهرية تكون مغلقة وفائزها محسوم' });
    }

    const maxScore = Math.max(...winners.map((w) => Number(w.finalScore ?? 0)));
    const tied = winners.filter((w) => Number(w.finalScore ?? 0) === maxScore);
    const isTie = tied.length > 1;

    const created = await this.prisma.quarterWinner.create({
      data: {
        year,
        quarter,
        company,
        employeeId: isTie ? null : tied[0].employeeId,
        finalScore: maxScore,
        isTie,
      },
    });

    if (isTie) {
      await this.notifyPermissionHolders(
        'star_of_month.nominate',
        'تعادل بنجم الربع — بانتظار حسمك',
        `في تعادل بين فائزي أشهر الربع ${QUARTER_NAMES_AR[quarter - 1]} ${year} بشركة ${company} — محتاج تحسمه`,
        { type: 'STAR_OF_MONTH_QUARTER_TIE_BREAK_NEEDED', year, quarter, company },
      );
    } else {
      const ok = await this.certificates.verifyGeneratable(tied[0].employeeId, company, created.awardedAt);
      if (ok) {
        await this.prisma.quarterWinner.update({ where: { id: created.id }, data: { certificateGeneratedAt: new Date() } });
      }
      await this.notifyEmployee(
        tied[0].employeeId,
        'مبروك نجم الربع!',
        `مبروك — فزتي/فزت بلقب نجم الربع ${QUARTER_NAMES_AR[quarter - 1]} ${year} بشركة ${company}. شهادة التقدير جاهزة للتحميل`,
        { type: 'STAR_OF_MONTH_QUARTER_WINNER', year, quarter, company },
      );
      await this.notifyPermissionHolders(
        'star_of_month.view',
        'فائز نجم الربع',
        `تحدَّد فائز نجم الربع ${QUARTER_NAMES_AR[quarter - 1]} ${year} بشركة ${company}`,
        { type: 'STAR_OF_MONTH_QUARTER_WINNER', year, quarter, company },
      );
    }

    return created;
  }

  // حسم تعادل نجم الربع — HR فقط (نفس صلاحية النومينيشن الشهري)
  async tieBreak(year: number, quarter: number, company: string, employeeId: string) {
    const row = await this.getOrThrow(year, quarter, company);
    if (!row.isTie) throw new BadRequestException({ code: 'NO_TIE', message: 'لا يوجد تعادل بهذا الربع — الفائز محسوم أصلاً' });

    const winners = await this.getMonthlyWinners(year, quarter, company);
    if (!winners) throw new BadRequestException({ code: 'QUARTER_NOT_READY', message: 'تعذّر إعادة التحقق من الفائزين الشهريين' });
    const maxScore = Math.max(...winners.map((w) => Number(w.finalScore ?? 0)));
    const tied = winners.filter((w) => Number(w.finalScore ?? 0) === maxScore);
    if (!tied.some((w) => w.employeeId === employeeId)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الموظف المختار ليس من ضمن المتعادلين الفعليين' });
    }

    const updated = await this.prisma.quarterWinner.update({
      where: { id: row.id },
      data: { employeeId, isTie: false, resolvedAt: new Date() },
    });

    const ok = await this.certificates.verifyGeneratable(employeeId, company, updated.awardedAt);
    if (ok) {
      await this.prisma.quarterWinner.update({ where: { id: updated.id }, data: { certificateGeneratedAt: new Date() } });
    }
    await this.notifyEmployee(
      employeeId,
      'مبروك نجم الربع!',
      `مبروك — فزتي/فزت بلقب نجم الربع ${QUARTER_NAMES_AR[quarter - 1]} ${year} بشركة ${company}. شهادة التقدير جاهزة للتحميل`,
      { type: 'STAR_OF_MONTH_QUARTER_WINNER', year, quarter, company },
    );
    return updated;
  }

  getQuarter(year: number, quarter: number) {
    return this.prisma.quarterWinner.findMany({ where: { year, quarter } });
  }

  async downloadCertificate(year: number, quarter: number, company: string): Promise<Buffer> {
    const row = await this.getOrThrow(year, quarter, company);
    if (row.isTie || !row.employeeId) {
      throw new BadRequestException({ code: 'TIE_UNRESOLVED', message: 'التعادل لسا غير محسوم — ما في فائز نهائي' });
    }
    return this.certificates.generatePdf(row.employeeId, company, row.awardedAt);
  }
}
