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
      const goals = employeeId
        ? await this.prisma.employeeGoal.findMany({
            where: { form: { employeeId, status: { not: 'COMPLETED' } } },
            select: { id: true, title: true, description: true, targetDate: true, weight: true, status: true },
            take: 10,
          })
        : [];
      return { goals };
    }

    if (role === 'MANAGER') {
      const pendingEvaluations = employeeId
        ? await this.prisma.evaluationForm.findMany({
            where: { evaluatorId: employeeId, status: 'PENDING_MANAGER' },
            select: { id: true, employeeId: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : [];

      const pendingProbations = employeeId
        ? await this.prisma.probationEvaluation.findMany({
            where: { evaluatorId: employeeId, status: 'DRAFT' },
            select: { id: true, employeeId: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : [];

      return { pendingEvaluations, pendingProbations };
    }

    if (role === 'HR') {
      const probationsPendingHR = await this.prisma.probationEvaluation.count({
        where: { status: 'PENDING_HR' },
      });
      const evaluationsPendingHR = await this.prisma.evaluationForm.count({
        where: { status: 'PENDING_HR_REVIEW' },
      });
      return { probationsPendingHR, evaluationsPendingHR };
    }

    if (role === 'CEO') {
      const probationsPendingCEO = await this.prisma.probationEvaluation.findMany({
        where: { status: 'PENDING_CEO' },
        select: { id: true, employeeId: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      return { probationsPendingCEO };
    }

    return {};
  }
}
