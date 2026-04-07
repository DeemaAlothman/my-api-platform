import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaveReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. رصيد الإجازات لكل الموظفين ────────────────────────────────────────

  async balances(year: number) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        employeeId: string;
        leaveTypeId: string;
        leaveTypeName: string;
        totalDays: number;
        usedDays: number;
        remainingDays: number;
        year: number;
      }>
    >`
      SELECT
        lb."employeeId",
        lb."leaveTypeId",
        lt."nameAr"     AS "leaveTypeName",
        lb."totalDays",
        lb."usedDays",
        lb."remainingDays",
        lb.year
      FROM leaves.leave_balances lb
      JOIN leaves.leave_types lt ON lt.id = lb."leaveTypeId"
      WHERE lb.year = ${year}
        AND lt."isActive" = true
      ORDER BY lb."employeeId", lt."nameAr"
    `;

    // تجميع حسب نوع الإجازة
    const byType: Record<string, { leaveTypeName: string; totalEmployees: number; avgRemaining: number }> = {};
    for (const r of rows) {
      if (!byType[r.leaveTypeId]) {
        byType[r.leaveTypeId] = { leaveTypeName: r.leaveTypeName, totalEmployees: 0, avgRemaining: 0 };
      }
      byType[r.leaveTypeId].totalEmployees++;
      byType[r.leaveTypeId].avgRemaining += r.remainingDays;
    }
    for (const key of Object.keys(byType)) {
      byType[key].avgRemaining = Math.round(byType[key].avgRemaining / byType[key].totalEmployees);
    }

    return {
      year,
      totalRecords: rows.length,
      byType: Object.values(byType),
      details: rows,
    };
  }

  // ─── 2. توزيع الإجازات المأخوذة حسب النوع والشهر ──────────────────────────

  async distribution(year: number) {
    const [byType, byMonth] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ leaveTypeName: string; requestCount: bigint; totalDays: number }>
      >`
        SELECT
          lt."nameAr"           AS "leaveTypeName",
          COUNT(lr.id)::bigint  AS "requestCount",
          COALESCE(SUM(lr."totalDays"), 0) AS "totalDays"
        FROM leaves.leave_requests lr
        JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
        WHERE lr.status = 'APPROVED'
          AND EXTRACT(YEAR FROM lr."startDate") = ${year}
        GROUP BY lt."nameAr"
        ORDER BY "totalDays" DESC
      `,

      this.prisma.$queryRaw<
        Array<{ month: number; requestCount: bigint; totalDays: number }>
      >`
        SELECT
          EXTRACT(MONTH FROM "startDate")::int AS month,
          COUNT(id)::bigint                    AS "requestCount",
          COALESCE(SUM("totalDays"), 0)     AS "totalDays"
        FROM leaves.leave_requests
        WHERE status = 'APPROVED'
          AND EXTRACT(YEAR FROM "startDate") = ${year}
        GROUP BY month
        ORDER BY month
      `,
    ]);

    return {
      year,
      byType: byType.map((r) => ({
        leaveTypeName: r.leaveTypeName,
        requestCount: Number(r.requestCount),
        totalDays: Number(r.totalDays),
      })),
      byMonth: byMonth.map((r) => ({
        month: r.month,
        requestCount: Number(r.requestCount),
        totalDays: Number(r.totalDays),
      })),
    };
  }

  // ─── 3. ملخص الطلبات (معلقة / موافق عليها / مرفوضة) ─────────────────────

  async summary(year: number) {
    const [byStatus, pending] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ status: string; count: bigint; totalDays: number }>
      >`
        SELECT
          status::text                         AS status,
          COUNT(id)::bigint                    AS count,
          COALESCE(SUM("totalDays"), 0)     AS "totalDays"
        FROM leaves.leave_requests
        WHERE EXTRACT(YEAR FROM "startDate") = ${year}
        GROUP BY status
        ORDER BY count DESC
      `,

      // تفصيل الطلبات المعلقة
      this.prisma.$queryRaw<
        Array<{
          id: string;
          employeeId: string;
          leaveTypeName: string;
          startDate: Date;
          endDate: Date;
          numberOfDays: number;
          status: string;
        }>
      >`
        SELECT
          lr.id,
          lr."employeeId",
          lt."nameAr"       AS "leaveTypeName",
          lr."startDate",
          lr."endDate",
          lr."totalDays",
          lr.status::text   AS status
        FROM leaves.leave_requests lr
        JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
        WHERE lr.status IN ('PENDING', 'PENDING_MANAGER', 'PENDING_HR')
          AND EXTRACT(YEAR FROM lr."startDate") = ${year}
        ORDER BY lr."startDate" ASC
        LIMIT 50
      `,
    ]);

    return {
      year,
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: Number(r.count),
        totalDays: Number(r.totalDays),
      })),
      pendingRequests: {
        count: pending.length,
        items: pending,
      },
    };
  }
}
