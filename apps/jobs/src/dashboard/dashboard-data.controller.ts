import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardDataController {
  constructor(private readonly prisma: PrismaService) {}

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

      return { candidatesByStage: byStage, activePositions };
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
      return { finalStageCandidates };
    }

    return {};
  }
}
