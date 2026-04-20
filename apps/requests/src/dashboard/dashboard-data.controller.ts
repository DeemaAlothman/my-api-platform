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

    if (role === 'EMPLOYEE') {
      const myRequests = employeeId
        ? await this.prisma.request.findMany({
            where: {
              employeeId,
              status: { in: ['PENDING_MANAGER', 'PENDING_HR', 'PENDING'] },
            },
            select: { id: true, type: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : [];
      return { pendingRequests: myRequests };
    }

    if (role === 'MANAGER') {
      const subordinateIds = employeeId
        ? await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM users.employees WHERE "managerId" = ${employeeId} AND "deletedAt" IS NULL
          `
        : [];
      const ids = subordinateIds.map(r => r.id);

      const pendingApprovals = ids.length
        ? await this.prisma.approvalStep.findMany({
            where: {
              status: 'PENDING',
              approverRole: 'DIRECT_MANAGER',
              request: { employeeId: { in: ids } },
            },
            include: {
              request: { select: { id: true, type: true, status: true, employeeId: true, createdAt: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];
      return { pendingRequestApprovals: pendingApprovals };
    }

    if (role === 'CEO') {
      const pendingCeoApprovals = await this.prisma.approvalStep.findMany({
        where: { status: 'PENDING', approverRole: 'CEO' },
        include: {
          request: { select: { id: true, type: true, status: true, employeeId: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { pendingCeoRequestApprovals: pendingCeoApprovals };
    }

    if (role === 'CFO') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const overtimeApproved = await this.prisma.request.count({
        where: {
          type: { in: ['OVERTIME_EMPLOYEE', 'OVERTIME_MANAGER'] },
          status: 'APPROVED',
          createdAt: { gte: firstDay },
        },
      });
      return { approvedOvertimeThisMonth: overtimeApproved };
    }

    return {};
  }
}
