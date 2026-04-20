import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardDataController {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveEmployeeId(username: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT e.id FROM users.employees e
      INNER JOIN users.users u ON e."userId" = u.id
      WHERE u.username = ${username} AND e."deletedAt" IS NULL
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  @Get('data')
  async getData(@Req() req: Request, @Query('role') role: string) {
    const username: string = (req as any).user?.username;
    const employeeId = await this.resolveEmployeeId(username);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (role === 'EMPLOYEE') {
      const attendance = employeeId
        ? await this.prisma.attendanceRecord.findFirst({
            where: { employeeId, date: today },
            select: { clockInTime: true, clockOutTime: true, status: true, workedMinutes: true, lateMinutes: true },
          })
        : null;
      return { attendance };
    }

    if (role === 'MANAGER') {
      const subordinateIds = employeeId
        ? await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM users.employees
            WHERE "managerId" = ${employeeId} AND "deletedAt" IS NULL
          `
        : [];
      const ids = subordinateIds.map(r => r.id);

      if (!ids.length) return { teamAttendanceToday: [] };

      const records = await this.prisma.attendanceRecord.findMany({
        where: { employeeId: { in: ids }, date: today },
        select: { employeeId: true, clockInTime: true, status: true, lateMinutes: true },
      });

      const present = records.filter(r => r.clockInTime).length;
      const absent  = ids.length - present;
      const late    = records.filter(r => r.lateMinutes > 0).length;

      return { teamAttendanceToday: { total: ids.length, present, absent, late, records } };
    }

    if (role === 'HR') {
      const now = new Date();
      const payroll = await this.prisma.monthlyPayroll.findFirst({
        where: { year: now.getFullYear(), month: now.getMonth() + 1 },
        select: { status: true, year: true, month: true },
        orderBy: { createdAt: 'desc' },
      });
      return { payrollStatus: payroll ?? null };
    }

    if (role === 'CEO') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const absentCount = await this.prisma.attendanceRecord.count({
        where: { date: { gte: firstDay }, status: 'ABSENT' },
      });
      return { monthlyAbsences: absentCount };
    }

    if (role === 'CFO') {
      const now = new Date();
      const payrolls = await this.prisma.monthlyPayroll.findMany({
        where: { year: now.getFullYear(), month: now.getMonth() + 1 },
        select: { basicSalary: true, allowancesTotal: true, deductionAmount: true, netSalary: true, status: true },
      });

      const totalBasic      = payrolls.reduce((s, p) => s + Number(p.basicSalary ?? 0), 0);
      const totalAllowances = payrolls.reduce((s, p) => s + Number(p.allowancesTotal ?? 0), 0);
      const totalDeductions = payrolls.reduce((s, p) => s + Number(p.deductionAmount ?? 0), 0);
      const totalNet        = payrolls.reduce((s, p) => s + Number(p.netSalary ?? 0), 0);
      const payrollStatus   = payrolls[0]?.status ?? null;

      return { payrollSummary: { totalBasic, totalAllowances, totalDeductions, totalNet, payrollStatus, employeeCount: payrolls.length } };
    }

    // GENERAL_MANAGER
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalRecords = await this.prisma.attendanceRecord.count({ where: { date: { gte: firstDay } } });
    const presentRecords = await this.prisma.attendanceRecord.count({ where: { date: { gte: firstDay }, status: 'PRESENT' } });
    const attendanceRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    return { monthlyAttendanceRate: attendanceRate };
  }
}
