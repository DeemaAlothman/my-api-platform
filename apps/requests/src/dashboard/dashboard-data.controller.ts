import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@shared/auth';
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

  // طلبات المدير المباشر المعلّقة — تُحسب بغض النظر عن الدور المرسَل، لأن مستخدم ممكن
  // يكون CEO/HR ومدير مباشر لموظفين بنفس الوقت، والدور المرسَل بيكون واحد بس (CEO له
  // أولوية بـderiveRole بالـgateway)
  private async getManagerPendingRequests(employeeId: string) {
    const subordinateIds = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM users.employees WHERE "managerId" = ${employeeId} AND "deletedAt" IS NULL
    `;
    const ids = subordinateIds.map(r => r.id);

    // REWARD/PENALTY_PROPOSAL: خطوة DM تخص مدير الموظف المستهدف بالتفاصيل لا مدير مقدّم الطلب
    // (نفس القاعدة المعتمدة بـapprove() و getPendingMyApproval) — فنجيب كل الخطوات المعلّقة ونفلتر بالكود
    const subordinateSet = new Set(ids);
    const pendingDmSteps = ids.length
      ? await this.prisma.approvalStep.findMany({
          where: { status: 'PENDING', approverRole: 'DIRECT_MANAGER' },
          include: {
            request: { select: { id: true, type: true, status: true, employeeId: true, details: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const pendingApprovals = pendingDmSteps.filter((s) => {
      const req = s.request as any;
      const details = req.details as any;
      const targetEmployeeId =
        req.type === 'REWARD' ? details?.employees?.[0]?.employeeId
        : req.type === 'PENALTY_PROPOSAL' ? details?.targetEmployeeId
        : req.employeeId;
      return targetEmployeeId && subordinateSet.has(targetEmployeeId);
    });
    return { pendingRequestApprovals: pendingApprovals };
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
              status: { in: ['PENDING_MANAGER', 'PENDING_HR', 'IN_APPROVAL'] },
            },
            select: { id: true, type: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : [];
      return { pendingRequests: myRequests };
    }

    if (role === 'MANAGER') {
      return employeeId ? this.getManagerPendingRequests(employeeId) : { pendingRequestApprovals: [] };
    }

    if (role === 'CEO') {
      const pendingCeoApprovals = await this.prisma.approvalStep.findMany({
        where: { status: 'PENDING', approverRole: 'CEO' },
        include: {
          request: { select: { id: true, type: true, status: true, employeeId: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      const managerData = employeeId ? await this.getManagerPendingRequests(employeeId) : null;
      return { pendingCeoRequestApprovals: pendingCeoApprovals, ...managerData };
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
      const managerData = employeeId ? await this.getManagerPendingRequests(employeeId) : null;
      return { approvedOvertimeThisMonth: overtimeApproved, ...managerData };
    }

    return {};
  }
}
