import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';

@Injectable()
export class ReceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReceptionDto, userId: string) {
    return this.prisma.podiatryReception.create({
      data: {
        patientId:           dto.patientId,
        height:              dto.height ?? null,
        weight:              dto.weight ?? null,
        occupation:          dto.occupation ?? null,
        activities:          dto.activities ?? null,
        problemDescription:  dto.problemDescription ?? null,
        historyOfSymptoms:   dto.historyOfSymptoms ?? null,
        affectedSide:        dto.affectedSide ?? [],
        footSymptoms:        dto.footSymptoms ?? [],
        visitTypes:          dto.visitTypes ?? [],
        medicalHistory:      dto.medicalHistory ?? [],
        medicalHistoryOther: dto.medicalHistoryOther ?? null,
        vasScore:            dto.vasScore ?? null,
        createdBy:           userId,
      },
      include: { sessions: true },
    });
  }

  async findAll(patientId?: string) {
    return this.prisma.podiatryReception.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    });
  }

  async findOne(id: string) {
    const reception = await this.prisma.podiatryReception.findUnique({
      where: { id },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    });
    if (!reception) throw new NotFoundException('Reception not found');
    return reception;
  }

  async update(id: string, dto: UpdateReceptionDto) {
    await this.findOne(id);
    return this.prisma.podiatryReception.update({
      where: { id },
      data: {
        ...(dto.height              !== undefined && { height: dto.height }),
        ...(dto.weight              !== undefined && { weight: dto.weight }),
        ...(dto.occupation          !== undefined && { occupation: dto.occupation }),
        ...(dto.activities          !== undefined && { activities: dto.activities }),
        ...(dto.problemDescription  !== undefined && { problemDescription: dto.problemDescription }),
        ...(dto.historyOfSymptoms   !== undefined && { historyOfSymptoms: dto.historyOfSymptoms }),
        ...(dto.affectedSide        !== undefined && { affectedSide: dto.affectedSide }),
        ...(dto.footSymptoms        !== undefined && { footSymptoms: dto.footSymptoms }),
        ...(dto.visitTypes          !== undefined && { visitTypes: dto.visitTypes }),
        ...(dto.medicalHistory      !== undefined && { medicalHistory: dto.medicalHistory }),
        ...(dto.medicalHistoryOther !== undefined && { medicalHistoryOther: dto.medicalHistoryOther }),
        ...(dto.vasScore            !== undefined && { vasScore: dto.vasScore }),
      },
      include: { sessions: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.podiatryReception.delete({ where: { id } });
  }
}
