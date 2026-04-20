import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
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

    if (role === 'EMPLOYEE') {
      const year = new Date().getFullYear();
      const leaveBalance = employeeId
        ? await this.prisma.leaveBalance.findMany({
            where: { employeeId, year },
            include: { leaveType: { select: { id: true, nameAr: true, nameEn: true, color: true } } },
          })
        : [];

      const pendingLeaveRequests = employeeId
        ? await this.prisma.leaveRequest.findMany({
            where: { employeeId, status: { in: ['PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUBSTITUTE'] }, deletedAt: null },
            include: { leaveType: { select: { nameAr: true, nameEn: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : [];

      return { leaveBalance, pendingLeaveRequests };
    }

    if (role === 'MANAGER') {
      const subordinateIds = employeeId
        ? await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM users.employees WHERE "managerId" = ${employeeId} AND "deletedAt" IS NULL
          `
        : [];
      const ids = subordinateIds.map(r => r.id);

      const pendingLeaveApprovals = ids.length
        ? await this.prisma.leaveRequest.findMany({
            where: { employeeId: { in: ids }, status: 'PENDING_MANAGER', deletedAt: null },
            include: { leaveType: { select: { nameAr: true, nameEn: true } } },
            orderBy: { createdAt: 'desc' },
          })
        : [];

      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const onLeaveThisWeek = ids.length
        ? await this.prisma.leaveRequest.findMany({
            where: {
              employeeId: { in: ids },
              status: 'APPROVED',
              startDate: { lte: weekEnd },
              endDate: { gte: now },
              deletedAt: null,
            },
            select: { employeeId: true, startDate: true, endDate: true, leaveTypeId: true },
          })
        : [];

      return { pendingLeaveApprovals, onLeaveThisWeek };
    }

    if (role === 'HR') {
      const pendingHRCount = await this.prisma.leaveRequest.count({
        where: { status: 'PENDING_HR', deletedAt: null },
      });
      return { pendingLeaveHRCount: pendingHRCount };
    }

    if (role === 'CEO') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const leaveCount = await this.prisma.leaveRequest.count({
        where: { status: 'APPROVED', startDate: { gte: firstDay }, deletedAt: null },
      });
      return { approvedLeavesThisMonth: leaveCount };
    }

    if (role === 'CFO') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const unpaidApproved = await this.prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { gte: firstDay },
          deletedAt: null,
          leaveType: { isPaid: false },
        },
        select: { employeeId: true, totalDays: true, startDate: true, endDate: true },
      });
      return { unpaidApprovedLeaves: unpaidApproved, unpaidLeaveDaysTotal: unpaidApproved.reduce((s, r) => s + r.totalDays, 0) };
    }

    return {};
  }
}
