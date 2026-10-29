import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@shared/auth';
import { PrismaService } from '../prisma/prisma.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardDataController {
  constructor(private readonly prisma: PrismaService) {}

  // المقابلات: qualifiedTotal = مرشحون لسا بمرحلة "مؤهل للمقابلة" (ELIGIBLE_FOR_INTERVIEW)
  // ولسا ما تحرّكوا لمرحلة تالية. conductedThisMonth = من جدول تقييم المقابلة المحلي
  // (evaluatedAt)، بغض النظر عن مرحلة المرشح الحالية الآن — هيك ما بتضيع مقابلة انعملت
  // هالشهر حتى لو المرشح انتقل بعدها لمرحلة تانية (نجح أو رُفض)
  private async getInterviews() {
    const qualifiedTotal = await this.prisma.candidate.count({
      where: { deletedAt: null, currentStage: 'ELIGIBLE_FOR_INTERVIEW' },
    });

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const conductedThisMonthItems = await this.prisma.interviewEvaluation.findMany({
      where: { evaluatedAt: { gte: thisMonthStart, lt: nextMonthStart } },
      select: {
        jobApplicationId: true,
        candidateName: true,
        evaluatedAt: true,
        position: { select: { jobTitle: true } },
      },
      orderBy: { evaluatedAt: 'desc' },
    });

    return {
      qualifiedTotal,
      conductedThisMonth: conductedThisMonthItems.length,
      conductedThisMonthItems: conductedThisMonthItems.map((e) => ({
        applicationId: e.jobApplicationId,
        candidateName: e.candidateName,
        jobTitle: e.position?.jobTitle ?? null,
        interviewDate: e.evaluatedAt ? e.evaluatedAt.toISOString().slice(0, 10) : null,
      })),
    };
  }

  @Get('data')
  async getData(@Req() req: Request, @Query('role') role: string) {
    if (role === 'HR') {
      const byStage = await this.prisma.$queryRaw<{ currentStage: string; count: bigint }[]>`
        SELECT "currentStage", COUNT(*) as count
        FROM jobs.candidates
        WHERE "deletedAt" IS NULL
          AND "currentStage" NOT IN ('HIRED', 'REJECTED')
        GROUP BY "currentStage"
      `;

      const activePositions = await this.prisma.interviewPosition.count({
        where: { status: 'OPEN' },
      });

      const interviews = await this.getInterviews();

      return { candidatesByStage: byStage, activePositions, interviews };
    }

    if (role === 'CEO') {
      const finalStageCandidates = await this.prisma.candidate.findMany({
        where: {
          deletedAt: null,
          currentStage: { in: ['CEO_APPROVAL', 'REFERENCE_CHECK'] },
        },
        select: {
          id: true,
          firstNameAr: true,
          lastNameAr: true,
          currentStage: true,
          position: { select: { jobTitle: true, department: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      const interviews = await this.getInterviews();
      return { finalStageCandidates, interviews };
    }

    return {};
  }
}
