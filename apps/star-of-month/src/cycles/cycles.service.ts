import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddHrNomineeDto } from './dto/cycle.dto';

// حالات attendance_records المعتبرة "يوم عمل مجدول" (يستثني WEEKEND/HOLIDAY)
const PRESENT_STATUSES = ['PRESENT', 'LATE', 'EARLY_LEAVE', 'HALF_DAY', 'ON_MISSION'];
const MIN_ATTENDANCE_RATE = 0.8;

interface EmployeeMetrics {
  employeeId: string;
  lateMinutesTotal: number;
  leaveUnitsTotal: number;
  substituteCount: number;
}

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  private monthRange(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0)); // آخر يوم بالشهر
    return { start, end };
  }

  async getOrCreateCycle(year: number, month: number) {
    let cycle = await this.prisma.cycle.findUnique({ where: { year_month: { year, month } } });
    if (!cycle) {
      cycle = await this.prisma.cycle.create({ data: { year, month } });
    }
    return cycle;
  }

  // حقول نتيجة التصويت — تُحذف من الاستجابة قبل إغلاق الدورة (السرية + "النتائج لا تظهر
  // حتى يُغلق التصويت")
  private static readonly RESULT_FIELDS = [
    'peerVoteCount', 'peerVoteScore', 'managerVoteReceived', 'managerVoteScore',
    'ceoVoteReceived', 'ceoVoteScore', 'finalScore', 'isWinner', 'wasTieBroken',
  ] as const;

  async getCycle(year: number, month: number) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { year_month: { year, month } },
      include: { candidates: true },
    });
    if (!cycle) throw new NotFoundException({ code: 'CYCLE_NOT_FOUND', message: 'لا توجد دورة لهذا الشهر بعد' });

    const candidates = cycle.candidates.map((c) => {
      if (cycle.status === 'CLOSED') return c;
      const clone: any = { ...c };
      for (const f of CyclesService.RESULT_FIELDS) delete clone[f];
      return clone;
    });

    const byCompany: Record<string, typeof candidates> = {};
    for (const c of candidates) {
      (byCompany[c.company] ??= []).push(c);
    }
    return { ...cycle, candidates, candidatesByCompany: byCompany };
  }

  // حساب القوائم التلقائية لكل شركة — قابل للاستدعاء يدوياً أو من cron يوم 1 من الشهر التالي.
  // آمن للاستدعاء المتكرر طالما الدورة لسا NOMINATING (بيعيد حساب مرشحي AUTO، ما يلمس HR)
  async generateCycle(year: number, month: number) {
    const cycle = await this.getOrCreateCycle(year, month);
    if (cycle.status !== 'NOMINATING') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'ما يمكن إعادة توليد القائمة بعد بدء التصويت أو إغلاق الدورة' });
    }

    const { start, end } = this.monthRange(year, month);
    const companies = await this.prisma.$queryRawUnsafe<Array<{ company: string }>>(
      `SELECT DISTINCT company FROM users.employees
       WHERE company IS NOT NULL AND "employmentStatus" = 'ACTIVE' AND "deletedAt" IS NULL`,
    );

    for (const { company } of companies) {
      const candidates = await this.computeCompanyCandidates(company, start, end);
      await this.prisma.$transaction(async (tx) => {
        await tx.candidate.deleteMany({ where: { cycleId: cycle.id, company, source: 'AUTO' } });
        if (candidates.length) {
          await tx.candidate.createMany({
            data: candidates.map((c) => ({ cycleId: cycle.id, company, source: 'AUTO' as const, ...c })),
          });
        }
      });
    }

    return this.prisma.cycle.update({
      where: { id: cycle.id },
      data: { nominationGeneratedAt: new Date() },
      include: { candidates: true },
    });
  }

  private async computeCompanyCandidates(company: string, start: Date, end: Date) {
    // الموظفون المؤهلون: نشطون بالشركة، بدون عقوبة فعّالة بالشهر (شرط أساسي يشمل مرشح HR أيضاً)
    const eligible = await this.prisma.$queryRawUnsafe<Array<{ employeeId: string; scheduledDays: bigint; presentDays: bigint; lateMinutesTotal: bigint }>>(
      `WITH eligible AS (
         SELECT e.id as "employeeId"
         FROM users.employees e
         WHERE e.company = $1
           AND e."employmentStatus" = 'ACTIVE'
           AND e."deletedAt" IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM users.employee_rewards_penalties p
             WHERE p."employeeId" = e.id AND p.kind = 'PENALTY' AND p.status = 'ACTIVE'
               AND p."effectiveDate" >= $2::date AND p."effectiveDate" <= $3::date
           )
       ),
       attendance_agg AS (
         SELECT ar."employeeId",
           COUNT(*) FILTER (WHERE ar.status NOT IN ('WEEKEND', 'HOLIDAY')) AS "scheduledDays",
           COUNT(*) FILTER (WHERE ar.status = ANY($4::text[])) AS "presentDays",
           COALESCE(SUM(ar."lateMinutes" + ar."earlyLeaveMinutes"), 0) AS "lateMinutesTotal"
         FROM attendance.attendance_records ar
         WHERE ar.date >= $2::date AND ar.date <= $3::date
         GROUP BY ar."employeeId"
       )
       SELECT el."employeeId",
         COALESCE(aa."scheduledDays", 0) AS "scheduledDays",
         COALESCE(aa."presentDays", 0) AS "presentDays",
         COALESCE(aa."lateMinutesTotal", 0) AS "lateMinutesTotal"
       FROM eligible el
       LEFT JOIN attendance_agg aa ON aa."employeeId" = el."employeeId"`,
      company, start, end, PRESENT_STATUSES,
    );

    // شرط 80% دوام عالأقل
    const qualified = eligible.filter((e) => {
      const scheduled = Number(e.scheduledDays);
      const present = Number(e.presentDays);
      return scheduled > 0 && present / scheduled >= MIN_ATTENDANCE_RATE;
    });
    if (!qualified.length) return [];

    const employeeIds = qualified.map((e) => e.employeeId);

    const leaveRows = await this.prisma.$queryRawUnsafe<Array<{ employeeId: string; leaveUnits: string }>>(
      `SELECT "employeeId", COALESCE(SUM(CASE WHEN "isHourlyLeave" THEN "durationHours" / 8.0 ELSE "totalDays" END), 0) as "leaveUnits"
       FROM leaves.leave_requests
       WHERE "employeeId" = ANY($1::text[])
         AND status = 'APPROVED'
         AND "deletedAt" IS NULL
         AND "startDate" <= $3::date AND "endDate" >= $2::date
       GROUP BY "employeeId"`,
      employeeIds, start, end,
    );
    const leaveMap = new Map(leaveRows.map((r) => [r.employeeId, Number(r.leaveUnits)]));

    const substituteRows = await this.prisma.$queryRawUnsafe<Array<{ employeeId: string; substituteCount: bigint }>>(
      `SELECT "substituteId" as "employeeId", COUNT(*) as "substituteCount"
       FROM leaves.leave_requests
       WHERE "substituteId" = ANY($1::text[])
         AND "substituteStatus" = 'APPROVED'
         AND "deletedAt" IS NULL
         AND "startDate" >= $2::date AND "startDate" <= $3::date
       GROUP BY "substituteId"`,
      employeeIds, start, end,
    );
    const substituteMap = new Map(substituteRows.map((r) => [r.employeeId, Number(r.substituteCount)]));

    const metrics: EmployeeMetrics[] = qualified.map((e) => ({
      employeeId: e.employeeId,
      lateMinutesTotal: Number(e.lateMinutesTotal),
      leaveUnitsTotal: leaveMap.get(e.employeeId) ?? 0,
      substituteCount: substituteMap.get(e.employeeId) ?? 0,
    }));

    const lateValues = metrics.map((m) => m.lateMinutesTotal);
    const leaveValues = metrics.map((m) => m.leaveUnitsTotal);
    const subValues = metrics.map((m) => m.substituteCount);

    const scored = metrics.map((m) => {
      const latenessScore = this.normalizeInverse(lateValues, m.lateMinutesTotal);
      const leaveScore = this.normalizeInverse(leaveValues, m.leaveUnitsTotal);
      const substituteScore = this.normalizeProportional(subValues, m.substituteCount);
      return {
        employeeId: m.employeeId,
        lateMinutesTotal: m.lateMinutesTotal,
        leaveUnitsTotal: m.leaveUnitsTotal,
        substituteCount: m.substituteCount,
        latenessScore,
        leaveScore,
        substituteScore,
        autoScoreTotal: latenessScore + leaveScore + substituteScore,
      };
    });

    // ترتيب تنازلي بالمجموع، وعند التعادل الأقل دقائق تأخير أولاً
    scored.sort((a, b) => b.autoScoreTotal - a.autoScoreTotal || a.lateMinutesTotal - b.lateMinutesTotal);
    return scored.slice(0, 4);
  }

  // الأقل قيمة = 10، الأكثر = 0، بالتناسب. تعادل الكل = 10 للجميع
  private normalizeInverse(values: number[], value: number): number {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 10;
    return Math.round((10 * (max - value)) / (max - min) * 100) / 100;
  }

  // الأكثر قيمة = 10، والباقون نسبة إليه، صفر يبقى صفر
  private normalizeProportional(values: number[], value: number): number {
    const max = Math.max(...values);
    if (max === 0) return 0;
    return Math.round((10 * value) / max * 100) / 100;
  }

  // مرشح HR — شرط عدم العقوبة يشمله، البصمة/الحضور ما بتنطبق عليه (نقاطه من التصويت لاحقاً)
  async addHrNominee(year: number, month: number, dto: AddHrNomineeDto) {
    const cycle = await this.getOrCreateCycle(year, month);
    if (cycle.status !== 'NOMINATING') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'ما يمكن إضافة مرشح HR بعد بدء التصويت أو إغلاق الدورة' });
    }

    const existingHr = await this.prisma.candidate.findFirst({
      where: { cycleId: cycle.id, company: dto.company, source: 'HR' },
    });
    if (existingHr) {
      throw new BadRequestException({ code: 'HR_NOMINEE_EXISTS', message: 'يوجد مرشح HR مضاف مسبقاً لهذه الشركة بهذه الدورة' });
    }

    const employee = await this.prisma.$queryRawUnsafe<Array<{ company: string | null; employmentStatus: string }>>(
      `SELECT company, "employmentStatus" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL`,
      dto.employeeId,
    );
    if (!employee.length) throw new NotFoundException({ code: 'EMPLOYEE_NOT_FOUND', message: 'الموظف غير موجود' });
    if (employee[0].employmentStatus !== 'ACTIVE') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الموظف غير نشط' });
    }
    if (employee[0].company !== dto.company) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الموظف لا ينتمي لهذه الشركة' });
    }

    const { start, end } = this.monthRange(year, month);
    const hasPenalty = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS(
         SELECT 1 FROM users.employee_rewards_penalties
         WHERE "employeeId" = $1 AND kind = 'PENALTY' AND status = 'ACTIVE'
           AND "effectiveDate" >= $2::date AND "effectiveDate" <= $3::date
       ) as exists`,
      dto.employeeId, start, end,
    );
    if (hasPenalty[0]?.exists) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الموظف عنده عقوبة فعّالة بهذا الشهر — غير مؤهل للترشيح' });
    }

    return this.prisma.candidate.create({
      data: { cycleId: cycle.id, company: dto.company, employeeId: dto.employeeId, source: 'HR' },
    });
  }
}
