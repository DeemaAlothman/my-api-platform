import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HrReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. ملخص الموظفين ──────────────────────────────────────────────────────

  async employeesSummary() {
    const [byDepartment, byGender, byNationality, byContractType, byStatus] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{ departmentAr: string; departmentEn: string; count: bigint }>
        >`
          SELECT
            COALESCE(d."nameAr", 'غير محدد')  AS "departmentAr",
            COALESCE(d."nameEn", 'Unassigned') AS "departmentEn",
            COUNT(e.id)::bigint                AS count
          FROM users.employees e
          LEFT JOIN users.departments d ON e."departmentId" = d.id
          WHERE e."deletedAt" IS NULL
            AND e."employmentStatus" = 'ACTIVE'
          GROUP BY d."nameAr", d."nameEn"
          ORDER BY count DESC
        `,

        this.prisma.$queryRaw<Array<{ gender: string; count: bigint }>>`
          SELECT
            COALESCE(gender::text, 'غير محدد') AS gender,
            COUNT(*)::bigint                    AS count
          FROM users.employees
          WHERE "deletedAt" IS NULL
            AND "employmentStatus" = 'ACTIVE'
          GROUP BY gender
        `,

        this.prisma.$queryRaw<Array<{ nationality: string; count: bigint }>>`
          SELECT
            COALESCE(nationality, 'غير محدد') AS nationality,
            COUNT(*)::bigint                   AS count
          FROM users.employees
          WHERE "deletedAt" IS NULL
            AND "employmentStatus" = 'ACTIVE'
          GROUP BY nationality
          ORDER BY count DESC
          LIMIT 20
        `,

        this.prisma.$queryRaw<Array<{ contractType: string; count: bigint }>>`
          SELECT
            "contractType"::text AS "contractType",
            COUNT(*)::bigint     AS count
          FROM users.employees
          WHERE "deletedAt" IS NULL
          GROUP BY "contractType"
        `,

        this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
          SELECT
            "employmentStatus"::text AS status,
            COUNT(*)::bigint         AS count
          FROM users.employees
          WHERE "deletedAt" IS NULL
          GROUP BY "employmentStatus"
        `,
      ]);

    const toNum = (arr: Array<{ [k: string]: any }>, countKey = 'count') =>
      arr.map((r) => ({ ...r, [countKey]: Number(r[countKey]) }));

    return {
      byDepartment:   toNum(byDepartment),
      byGender:       toNum(byGender),
      byNationality:  toNum(byNationality),
      byContractType: toNum(byContractType),
      byStatus:       toNum(byStatus),
    };
  }

  // ─── 2. الدوران الوظيفي ────────────────────────────────────────────────────

  async turnover(year: number) {
    const [hired, terminated] = await Promise.all([
      this.prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
        SELECT
          DATE_TRUNC('month', "hireDate") AS month,
          COUNT(*)::bigint                AS count
        FROM users.employees
        WHERE "deletedAt" IS NULL
          AND EXTRACT(YEAR FROM "hireDate") = ${year}
        GROUP BY month
        ORDER BY month
      `,

      this.prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
        SELECT
          DATE_TRUNC('month', "deletedAt") AS month,
          COUNT(*)::bigint                 AS count
        FROM users.employees
        WHERE "deletedAt" IS NOT NULL
          AND EXTRACT(YEAR FROM "deletedAt") = ${year}
        GROUP BY month
        ORDER BY month
      `,
    ]);

    const fmt = (arr: Array<{ month: Date; count: bigint }>) =>
      arr.map((r) => ({
        month: r.month,
        count: Number(r.count),
      }));

    return { year, hired: fmt(hired), terminated: fmt(terminated) };
  }

  // ─── 3. تقرير الرواتب ─────────────────────────────────────────────────────

  async salaries() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        departmentAr: string;
        departmentEn: string;
        employeeCount: bigint;
        totalSalary: string | null;
        avgSalary: string | null;
        minSalary: string | null;
        maxSalary: string | null;
        currency: string;
      }>
    >`
      SELECT
        COALESCE(d."nameAr", 'غير محدد')  AS "departmentAr",
        COALESCE(d."nameEn", 'Unassigned') AS "departmentEn",
        COUNT(e.id)::bigint                AS "employeeCount",
        SUM(e."basicSalary")               AS "totalSalary",
        AVG(e."basicSalary")               AS "avgSalary",
        MIN(e."basicSalary")               AS "minSalary",
        MAX(e."basicSalary")               AS "maxSalary",
        COALESCE(MAX(e."salaryCurrency"), 'SYP') AS currency
      FROM users.employees e
      LEFT JOIN users.departments d ON e."departmentId" = d.id
      WHERE e."deletedAt" IS NULL
        AND e."employmentStatus" = 'ACTIVE'
        AND e."basicSalary" IS NOT NULL
      GROUP BY d."nameAr", d."nameEn"
      ORDER BY "totalSalary" DESC NULLS LAST
    `;

    return rows.map((r) => ({
      departmentAr:  r.departmentAr,
      departmentEn:  r.departmentEn,
      employeeCount: Number(r.employeeCount),
      totalSalary:   r.totalSalary ? parseFloat(r.totalSalary) : null,
      avgSalary:     r.avgSalary   ? parseFloat(r.avgSalary)   : null,
      minSalary:     r.minSalary   ? parseFloat(r.minSalary)   : null,
      maxSalary:     r.maxSalary   ? parseFloat(r.maxSalary)   : null,
      currency:      r.currency,
    }));
  }

  // ─── 4. تواريخ الاستحقاق ──────────────────────────────────────────────────

  async expiryDates(daysAhead: number) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        employeeNumber: string;
        firstNameAr: string;
        lastNameAr: string;
        contractType: string;
        contractEndDate: Date;
        departmentAr: string;
        daysRemaining: number;
      }>
    >`
      SELECT
        e.id,
        e."employeeNumber",
        e."firstNameAr",
        e."lastNameAr",
        e."contractType"::text        AS "contractType",
        e."contractEndDate",
        COALESCE(d."nameAr", 'غير محدد') AS "departmentAr",
        (e."contractEndDate"::date - CURRENT_DATE) AS "daysRemaining"
      FROM users.employees e
      LEFT JOIN users.departments d ON e."departmentId" = d.id
      WHERE e."deletedAt" IS NULL
        AND e."contractEndDate" IS NOT NULL
        AND e."contractEndDate" >= CURRENT_DATE
        AND e."contractEndDate" <= CURRENT_DATE + (${daysAhead} || ' days')::INTERVAL
      ORDER BY e."contractEndDate" ASC
    `;

    return {
      daysAhead,
      count: rows.length,
      items: rows,
    };
  }

  // ─── 5. تقرير العهدة ──────────────────────────────────────────────────────

  async custodies(status?: string, departmentId?: string) {
    const statusFilter = status === 'RETURNED'
      ? `AND c.status = 'RETURNED'`
      : status === 'ACTIVE'
      ? `AND c.status = 'WITH_EMPLOYEE'`
      : '';

    const deptFilter = departmentId
      ? `AND e."departmentId" = '${departmentId}'`
      : '';

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        e."employeeNumber",
        e."firstNameAr" || ' ' || e."lastNameAr" AS "employeeNameAr",
        COALESCE(d."nameAr", 'غير محدد') AS "departmentAr",
        c.name AS "custodyName",
        c.category AS "category",
        c."assignedDate" AS "handedOverAt",
        c.status AS "status",
        c."returnedDate" AS "returnedAt",
        c.notes AS "notes"
      FROM users.custodies c
      JOIN users.employees e ON e.id = c."employeeId"
      LEFT JOIN users.departments d ON d.id = e."departmentId"
      WHERE c."deletedAt" IS NULL
        AND e."deletedAt" IS NULL
        ${statusFilter}
        ${deptFilter}
      ORDER BY e."employeeNumber", c."assignedDate"
    `);

    return rows;
  }
}
