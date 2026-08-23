import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildAssessmentData(dto: CreateSessionDto) {
    return {
      ...(dto.subjectiveHistory !== undefined && { subjectiveHistory: dto.subjectiveHistory }),
      ...(dto.visualInspection  !== undefined && { visualInspection:  dto.visualInspection }),
      ...(dto.palpation         !== undefined && { palpation:         dto.palpation }),
      ...(dto.rangeOfMotion     !== undefined && { rangeOfMotion:     dto.rangeOfMotion }),
      ...(dto.dynamicAnalysis   !== undefined && { dynamicAnalysis:   dto.dynamicAnalysis }),
      ...(dto.shoeWearPattern   !== undefined && { shoeWearPattern:   dto.shoeWearPattern }),
      ...(dto.footMeasurements  !== undefined && { footMeasurements:  dto.footMeasurements }),
      ...(dto.insoleType        !== undefined && { insoleType:        dto.insoleType }),
      ...(dto.notes             !== undefined && { notes:             dto.notes }),
      ...(dto.clinicianName     !== undefined && { clinicianName:     dto.clinicianName }),
      ...(dto.clinicianSignature !== undefined && { clinicianSignature: dto.clinicianSignature }),
      ...(dto.doctorDecision    !== undefined && { doctorDecision:    dto.doctorDecision }),
    };
  }

  async create(receptionId: string, dto: CreateSessionDto, userId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');

    // جلسة واحدة بس لكل استقبال – upsert
    const existing = await this.prisma.podiatrySession.findFirst({
      where: { receptionId, archivedAt: null },
    });

    if (existing) {
      return this.prisma.podiatrySession.update({
        where: { id: existing.id },
        data: this.buildAssessmentData(dto),
      });
    }

    return this.prisma.podiatrySession.create({
      data: {
        receptionId,
        patientId:   reception.patientId,
        clinicalPlan: [],
        createdBy:   userId,
        ...this.buildAssessmentData(dto),
      },
    });
  }

  private async resolveUserName(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ fullName: string | null }>>(
      `SELECT "fullName" FROM users.users WHERE id = $1`,
      userId,
    );
    return rows[0]?.fullName ?? null;
  }

  async findAll(receptionId: string, includeArchived = false) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');
    const sessions = await this.prisma.podiatrySession.findMany({
      where: { receptionId, ...(!includeArchived && { archivedAt: null }) },
      orderBy: { sessionDate: 'asc' },
    });
    const userIds = [...new Set(sessions.map(s => s.createdBy).filter(Boolean))];
    let userMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; fullName: string | null }>>(
        `SELECT id, "fullName" FROM users.users WHERE id IN (${placeholders})`,
        ...userIds,
      );
      userMap = Object.fromEntries(rows.map(r => [r.id, r.fullName ?? '']));
    }
    return sessions.map(s => ({ ...s, createdByName: userMap[s.createdBy] ?? null }));
  }

  async findOne(receptionId: string, sessionId: string) {
    const session = await this.prisma.podiatrySession.findFirst({
      where: { id: sessionId, receptionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    const createdByName = await this.resolveUserName(session.createdBy);
    return { ...session, createdByName };
  }

  async update(receptionId: string, sessionId: string, dto: UpdateSessionDto) {
    await this.findOne(receptionId, sessionId);
    return this.prisma.podiatrySession.update({
      where: { id: sessionId },
      data: this.buildAssessmentData(dto),
    });
  }

  async archive(receptionId: string, sessionId: string, userId: string) {
    await this.findOne(receptionId, sessionId);
    return this.prisma.podiatrySession.update({
      where: { id: sessionId },
      data: { archivedAt: new Date(), archivedBy: userId },
    });
  }

  async remove(receptionId: string, sessionId: string) {
    await this.findOne(receptionId, sessionId);
    return this.prisma.podiatrySession.delete({ where: { id: sessionId } });
  }
}
