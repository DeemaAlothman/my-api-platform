import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@shared/auth';
import { PrismaService } from '../prisma/prisma.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardDataController {
  constructor(private readonly prisma: PrismaService) {}

  // المباشرات والانفكاكات بالشهر الحالي. الانفكاك = نفس تعريف تقرير الدوران الوظيفي
  // المعتمد أصلاً (hr-reports turnover()): employmentStatus IN (INACTIVE, TERMINATED)،
  // وتاريخه separationDate، أو تاريخ إنهاء فترة التجربة كبديل لو كان إنهاء تجربة (ما
  // بيكتب separationDate). reason: PROBATION_TERMINATION لإنهاء التجربة، RESIGNATION
  // لو في طلب استقالة معتمد، وإلا TERMINATION كحالة عامة.
  private async getWorkforceThisMonth() {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const employeesTotal = await this.prisma.employee.count({
      where: { deletedAt: null, employmentStatus: 'ACTIVE' },
    });

    const joined = await this.prisma.employee.findMany({
      where: { deletedAt: null, hireDate: { gte: thisMonthStart, lt: nextMonthStart } },
      select: {
        id: true, firstNameAr: true, lastNameAr: true, hireDate: true,
        jobTitle: { select: { nameAr: true } },
        department: { select: { nameAr: true } },
      },
      orderBy: { hireDate: 'desc' },
    });

    const separated = await this.prisma.$queryRawUnsafe<Array<{
      id: string; firstNameAr: string; lastNameAr: string;
      jobTitle: string | null; department: string | null;
      separated_at: Date; reason: string;
    }>>(
      `WITH sep AS (
         SELECT
           e.id, e."firstNameAr", e."lastNameAr", e."jobTitleId", e."departmentId",
           COALESCE(
             e."separationDate"::timestamp,
             CASE WHEN e."employmentStatus" = 'TERMINATED' AND e."probationResult" = 'TERMINATE'
                  THEN e."probationCompletedAt" END
           ) AS separated_at,
           (e."employmentStatus" = 'TERMINATED' AND e."probationResult" = 'TERMINATE') AS is_probation
         FROM users.employees e
         WHERE e."deletedAt" IS NULL AND e."employmentStatus" IN ('INACTIVE', 'TERMINATED')
       )
       SELECT
         sep.id, sep."firstNameAr", sep."lastNameAr",
         jt."nameAr" AS "jobTitle", d."nameAr" AS department,
         sep.separated_at,
         CASE
           WHEN sep.is_probation THEN 'PROBATION_TERMINATION'
           WHEN EXISTS (
             SELECT 1 FROM requests.requests r
             WHERE r."employeeId" = sep.id AND r.type::text = 'RESIGNATION' AND r.status::text = 'APPROVED'
           ) THEN 'RESIGNATION'
           ELSE 'TERMINATION'
         END AS reason
       FROM sep
       LEFT JOIN users.job_titles jt ON jt.id = sep."jobTitleId"
       LEFT JOIN users.departments d ON d.id = sep."departmentId"
       WHERE sep.separated_at >= $1 AND sep.separated_at < $2
       ORDER BY sep.separated_at DESC`,
      thisMonthStart, nextMonthStart,
    ).catch(() => [] as any[]);

    return {
      employeesTotal,
      joinedThisMonth: joined.length,
      joinedThisMonthItems: joined.map((e) => ({
        employeeId: e.id,
        name: `${e.firstNameAr} ${e.lastNameAr}`,
        jobTitle: e.jobTitle?.nameAr ?? null,
        department: e.department?.nameAr ?? null,
        hireDate: e.hireDate.toISOString().slice(0, 10),
      })),
      separatedThisMonth: separated.length,
      separatedThisMonthItems: separated.map((e) => ({
        employeeId: e.id,
        name: `${e.firstNameAr} ${e.lastNameAr}`,
        jobTitle: e.jobTitle,
        department: e.department,
        separationDate: new Date(e.separated_at).toISOString().slice(0, 10),
        reason: e.reason,
      })),
    };
  }

  @Get('data')
  async getData(@Req() req: Request, @Query('role') role: string) {
    const userId: string = (req as any).user?.userId;

    const employee = await this.prisma.employee.findFirst({
      where: { userId, deletedAt: null },
      include: {
        department: { select: { id: true, nameAr: true, nameEn: true } },
        jobTitle:   { select: { id: true, nameAr: true, nameEn: true } },
      },
    });

    const notifications = await this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, titleAr: true, titleEn: true, messageAr: true, messageEn: true, type: true, data: true, createdAt: true },
    });

    const employeeProfile = employee ? {
      id:             employee.id,
      employeeNumber: employee.employeeNumber,
      firstNameAr:    employee.firstNameAr,
      lastNameAr:     employee.lastNameAr,
      firstNameEn:    employee.firstNameEn,
      lastNameEn:     employee.lastNameEn,
      department:     employee.department,
      jobTitle:       employee.jobTitle,
      employmentStatus: employee.employmentStatus,
    } : null;

    if (role === 'EMPLOYEE') {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringDocuments = employee
        ? await this.prisma.employeeDocument.findMany({
            where: {
              employeeId: employee.id,
              expiryDate: { lte: thirtyDaysFromNow, gte: new Date() },
              deletedAt: null,
            },
            select: { id: true, titleAr: true, titleEn: true, expiryDate: true, type: true },
          })
        : [];

      return { employee: employeeProfile, notifications, expiringDocuments };
    }

    if (role === 'MANAGER') {
      const subordinates = employee
        ? await this.prisma.employee.findMany({
            where: { managerId: employee.id, deletedAt: null },
            select: { id: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true, employmentStatus: true },
          })
        : [];

      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const teamAlerts = subordinates.length
        ? await this.prisma.employeeDocument.findMany({
            where: {
              employeeId: { in: subordinates.map(s => s.id) },
              expiryDate: { lte: thirtyDaysFromNow, gte: new Date() },
              deletedAt: null,
            },
            select: { id: true, employeeId: true, titleAr: true, expiryDate: true },
          })
        : [];

      return { employee: employeeProfile, notifications, team: subordinates, teamAlerts };
    }

    if (role === 'HR') {
      const totalEmployees = await this.prisma.employee.count({ where: { deletedAt: null, employmentStatus: 'ACTIVE' } });

      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringDocs = await this.prisma.employeeDocument.count({
        where: { expiryDate: { lte: thirtyDaysFromNow, gte: new Date() }, deletedAt: null },
      });

      const expiringContracts = await this.prisma.employee.count({
        where: {
          contractEndDate: { lte: thirtyDaysFromNow, gte: new Date() },
          deletedAt: null,
        },
      });

      const workforce = await this.getWorkforceThisMonth();

      return {
        employee: employeeProfile, notifications, totalEmployees,
        expiringDocsCount: expiringDocs, expiringContractsCount: expiringContracts,
        workforce,
      };
    }

    if (role === 'CEO') {
      return { employee: employeeProfile, notifications };
    }

    if (role === 'CFO') {
      const allowances = employee
        ? await this.prisma.employeeAllowance.findMany({
            where: { employeeId: employee.id },
            select: { type: true, amount: true },
          })
        : [];
      const allowancesTotal = allowances.reduce((sum, a) => sum + Number(a.amount), 0);
      return { employee: employeeProfile, notifications, allowances, allowancesTotal };
    }

    // GENERAL_MANAGER
    const totalEmployees = await this.prisma.employee.count({ where: { deletedAt: null, employmentStatus: 'ACTIVE' } });

    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const newEmployeesThisMonth = await this.prisma.employee.count({
      where: { hireDate: { gte: firstDayOfMonth }, deletedAt: null },
    });

    const deptDistribution = await this.prisma.department.findMany({
      where: { deletedAt: null },
      select: {
        id: true, nameAr: true, nameEn: true,
        _count: { select: { employees: { where: { deletedAt: null } } } },
      },
    });

    return { employee: employeeProfile, notifications, totalEmployees, newEmployeesThisMonth, departmentDistribution: deptDistribution };
  }
}
