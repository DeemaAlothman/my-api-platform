import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EvaluationReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. توزيع درجات التقييم ───────────────────────────────────────────────

  async gradeDistribution(periodId?: string) {
    const periodCondition = periodId ? `AND ef."periodId" = '${periodId}'` : '';

    const [byRating, byScore] = await Promise.all([
      this.prisma.$queryRawUnsafe(`
        SELECT
          "finalRating"::text AS rating,
          COUNT(*)::text      AS count
        FROM evaluation."EvaluationForm" ef
        WHERE ef."finalRating" IS NOT NULL
          AND ef.status = 'COMPLETED'
          ${periodCondition}
        GROUP BY "finalRating"
        ORDER BY count DESC
      `) as Promise<Array<{ rating: string; count: string }>>,

      this.prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::text                              AS total,
          ROUND(AVG("finalScore")::numeric, 2)::text  AS "avgScore",
          MIN("finalScore")::text                     AS "minScore",
          MAX("finalScore")::text                     AS "maxScore"
        FROM evaluation."EvaluationForm"
        WHERE "finalScore" IS NOT NULL
          AND status = 'COMPLETED'
          ${periodCondition}
      `) as Promise<Array<{ total: string; avgScore: string; minScore: string; maxScore: string }>>,
    ]);

    const ratingRows = byRating as Array<{ rating: string; count: string }>;
    const scoreRows = byScore as Array<{ total: string; avgScore: string; minScore: string; maxScore: string }>;
    const s = scoreRows[0];

    return {
      periodId: periodId ?? null,
      byRating: ratingRows.map((r) => ({
        rating: r.rating,
        count: parseInt(r.count),
      })),
      scoreStats: s ? {
        total: parseInt(s.total),
        avgScore: s.avgScore ? parseFloat(s.avgScore) : null,
        minScore: s.minScore ? parseFloat(s.minScore) : null,
        maxScore: s.maxScore ? parseFloat(s.maxScore) : null,
      } : null,
    };
  }

  // ─── 2. مقارنة أداء الأقسام ───────────────────────────────────────────────

  async departmentComparison(periodId?: string) {
    const periodCondition = periodId ? `AND ef."periodId" = '${periodId}'` : '';

    const rows = (await this.prisma.$queryRawUnsafe(`
      SELECT
        e."departmentId",
        d."nameAr"                                    AS "departmentName",
        COUNT(ef.id)::text                            AS "evaluationCount",
        ROUND(AVG(ef."finalScore")::numeric, 2)::text    AS "avgScore",
        ROUND(AVG(ef."selfScore")::numeric, 2)::text    AS "avgSelfScore",
        ROUND(AVG(ef."managerScore")::numeric, 2)::text AS "avgManagerScore"
      FROM evaluation."EvaluationForm" ef
      JOIN users.employees e ON e.id = ef."employeeId"
      LEFT JOIN users.departments d ON d.id = e."departmentId"
      WHERE ef."finalScore" IS NOT NULL
        AND ef.status = 'COMPLETED'
        ${periodCondition}
      GROUP BY e."departmentId", d."nameAr"
      ORDER BY "avgScore" DESC NULLS LAST
    `)) as Array<{
      departmentId: string;
      departmentName: string;
      evaluationCount: string;
      avgScore: string;
      avgSelfScore: string;
      avgManagerScore: string;
    }>;

    return {
      periodId: periodId ?? null,
      departments: rows.map((r) => ({
        departmentId: r.departmentId,
        departmentName: r.departmentName ?? 'غير محدد',
        evaluationCount: parseInt(r.evaluationCount),
        avgScore: r.avgScore ? parseFloat(r.avgScore) : null,
        avgSelfScore: r.avgSelfScore ? parseFloat(r.avgSelfScore) : null,
        avgManagerScore: r.avgManagerScore ? parseFloat(r.avgManagerScore) : null,
      })),
    };
  }

  // ─── 3. الموظفون الحاصلون على توصيات ─────────────────────────────────────

  async recommendations(periodId?: string) {
    const periodCondition = periodId ? `AND ef."periodId" = '${periodId}'` : '';

    const rows = (await this.prisma.$queryRawUnsafe(`
      SELECT
        ef."employeeId",
        e."employeeNumber",
        e."firstNameAr",
        e."lastNameAr",
        d."nameAr"                 AS "departmentName",
        ef."finalScore",
        ef."finalRating"::text     AS "finalRating",
        ef."hrRecommendation"::text AS "hrRecommendation",
        ef."managerRecommendations"
      FROM evaluation."EvaluationForm" ef
      JOIN users.employees e ON e.id = ef."employeeId"
      LEFT JOIN users.departments d ON d.id = e."departmentId"
      WHERE ef.status = 'COMPLETED'
        AND ef."hrRecommendation" IS NOT NULL
        ${periodCondition}
      ORDER BY ef."finalScore" DESC NULLS LAST
    `)) as Array<{
      employeeId: string;
      employeeNumber: string;
      firstNameAr: string;
      lastNameAr: string;
      departmentName: string;
      finalScore: number;
      finalRating: string;
      hrRecommendation: string;
      managerRecommendations: string;
    }>;

    // تجميع حسب نوع التوصية
    const byRecommendation: Record<string, number> = {};
    for (const r of rows) {
      byRecommendation[r.hrRecommendation] = (byRecommendation[r.hrRecommendation] ?? 0) + 1;
    }

    return {
      periodId: periodId ?? null,
      total: rows.length,
      byRecommendation,
      items: rows,
    };
  }
}
