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

  // طلبات المدير المباشر المعلّقة (تقييمات + فترات تجربة) — تُحسب بغض النظر عن الدور
  // المرسَل، لأن مستخدم ممكن يكون CEO/HR ومدير مباشر لموظفين بنفس الوقت، والدور المرسَل
  // بيكون واحد بس (CEO له أولوية بـderiveRole بالـgateway)
  private async getManagerPendingData(employeeId: string) {
    const pendingEvaluations = await this.prisma.evaluationForm.findMany({
      where: { evaluatorId: employeeId, status: 'PENDING_MANAGER' },
      select: { id: true, employeeId: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const pendingProbations = await this.prisma.probationEvaluation.findMany({
      where: { evaluatorId: employeeId, status: 'DRAFT' },
      select: { id: true, employeeId: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return { pendingEvaluations, pendingProbations };
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
      return employeeId ? this.getManagerPendingData(employeeId) : { pendingEvaluations: [], pendingProbations: [] };
    }

    if (role === 'HR') {
      const probationsPendingHR = await this.prisma.probationEvaluation.count({
        where: { status: 'PENDING_HR' },
      });
      const evaluationsPendingHR = await this.prisma.evaluationForm.count({
        where: { status: 'PENDING_HR_REVIEW' },
      });
      const managerData = employeeId ? await this.getManagerPendingData(employeeId) : null;
      return { probationsPendingHR, evaluationsPendingHR, ...managerData };
    }

    if (role === 'CEO') {
      const probationsPendingCEO = await this.prisma.probationEvaluation.findMany({
        where: { status: 'PENDING_CEO' },
        select: { id: true, employeeId: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      const managerData = employeeId ? await this.getManagerPendingData(employeeId) : null;
      return { probationsPendingCEO, ...managerData };
    }

    return {};
  }
}
