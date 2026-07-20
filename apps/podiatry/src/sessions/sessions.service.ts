import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(receptionId: string, dto: CreateSessionDto, userId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');

    return this.prisma.podiatrySession.create({
      data: {
        receptionId,
        patientId:          reception.patientId,
        clinicalPlan:       dto.clinicalPlan ?? [],
        rightFlatFoot:      dto.rightFlatFoot ?? false,
        rightHighArch:      dto.rightHighArch ?? false,
        rightPronation:     dto.rightPronation ?? false,
        rightSupination:    dto.rightSupination ?? false,
        rightPressureNotes: dto.rightPressureNotes ?? null,
        rightAsymmetry:     dto.rightAsymmetry ?? null,
        leftFlatFoot:       dto.leftFlatFoot ?? false,
        leftHighArch:       dto.leftHighArch ?? false,
        leftPronation:      dto.leftPronation ?? false,
        leftSupination:     dto.leftSupination ?? false,
        leftPressureNotes:  dto.leftPressureNotes ?? null,
        leftAsymmetry:      dto.leftAsymmetry ?? null,
        clinicianName:      dto.clinicianName ?? null,
        clinicianSignature: dto.clinicianSignature ?? null,
        createdBy:          userId,
      },
    });
  }

  async findAll(receptionId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');
    return this.prisma.podiatrySession.findMany({
      where: { receptionId },
      orderBy: { sessionDate: 'asc' },
    });
  }

  async findOne(receptionId: string, sessionId: string) {
    const session = await this.prisma.podiatrySession.findFirst({
      where: { id: sessionId, receptionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async update(receptionId: string, sessionId: string, dto: UpdateSessionDto) {
    await this.findOne(receptionId, sessionId);
    return this.prisma.podiatrySession.update({
      where: { id: sessionId },
      data: {
        ...(dto.clinicalPlan       !== undefined && { clinicalPlan: dto.clinicalPlan }),
        ...(dto.rightFlatFoot      !== undefined && { rightFlatFoot: dto.rightFlatFoot }),
        ...(dto.rightHighArch      !== undefined && { rightHighArch: dto.rightHighArch }),
        ...(dto.rightPronation     !== undefined && { rightPronation: dto.rightPronation }),
        ...(dto.rightSupination    !== undefined && { rightSupination: dto.rightSupination }),
        ...(dto.rightPressureNotes !== undefined && { rightPressureNotes: dto.rightPressureNotes }),
        ...(dto.rightAsymmetry     !== undefined && { rightAsymmetry: dto.rightAsymmetry }),
        ...(dto.leftFlatFoot       !== undefined && { leftFlatFoot: dto.leftFlatFoot }),
        ...(dto.leftHighArch       !== undefined && { leftHighArch: dto.leftHighArch }),
        ...(dto.leftPronation      !== undefined && { leftPronation: dto.leftPronation }),
        ...(dto.leftSupination     !== undefined && { leftSupination: dto.leftSupination }),
        ...(dto.leftPressureNotes  !== undefined && { leftPressureNotes: dto.leftPressureNotes }),
        ...(dto.leftAsymmetry      !== undefined && { leftAsymmetry: dto.leftAsymmetry }),
        ...(dto.clinicianName      !== undefined && { clinicianName: dto.clinicianName }),
        ...(dto.clinicianSignature !== undefined && { clinicianSignature: dto.clinicianSignature }),
      },
    });
  }

  async remove(receptionId: string, sessionId: string) {
    await this.findOne(receptionId, sessionId);
    return this.prisma.podiatrySession.delete({ where: { id: sessionId } });
  }
}
