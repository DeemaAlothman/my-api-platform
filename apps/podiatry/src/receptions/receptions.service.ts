import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { ComplaintDto, MedicalHistoryDto } from './dto/complaint.dto';

const PATIENTS_URL   = process.env.PATIENTS_SERVICE_URL   || 'http://patients:4010';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

@Injectable()
export class ReceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolvePatients(
    patientIds: string[],
  ): Promise<Record<string, { firstName: string; lastName: string; patientNumber: string }>> {
    const ids = [...new Set(patientIds.filter(Boolean))];
    if (ids.length === 0) return {};
    try {
      const res = await fetch(`${PATIENTS_URL}/api/v1/patients/internal/find-by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
        body: JSON.stringify({ patientIds: ids }),
      });
      if (!res.ok) return {};
      const json: any = await res.json();
      const list: any[] = Array.isArray(json) ? json : (json?.data ?? []);
      const map: Record<string, any> = {};
      for (const p of list) {
        if (p?.id) map[p.id] = { firstName: p.firstName, lastName: p.lastName, patientNumber: p.patientNumber };
      }
      return map;
    } catch {
      return {};
    }
  }

  async create(dto: CreateReceptionDto, userId: string) {
    const reception = await this.prisma.podiatryReception.create({
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
    const patientMap = await this.resolvePatients([reception.patientId]);
    return { ...reception, patient: patientMap[reception.patientId] ?? null };
  }

  async findAll(patientId?: string) {
    const receptions = await this.prisma.podiatryReception.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    });
    const patientMap = await this.resolvePatients(receptions.map(r => r.patientId));
    return receptions.map(r => ({ ...r, patient: patientMap[r.patientId] ?? null }));
  }

  async findOne(id: string) {
    const reception = await this.prisma.podiatryReception.findUnique({
      where: { id },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    });
    if (!reception) throw new NotFoundException('Reception not found');
    const patientMap = await this.resolvePatients([reception.patientId]);
    return { ...reception, patient: patientMap[reception.patientId] ?? null };
  }

  async update(id: string, dto: UpdateReceptionDto) {
    const reception = await this.prisma.podiatryReception.update({
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
    const patientMap = await this.resolvePatients([reception.patientId]);
    return { ...reception, patient: patientMap[reception.patientId] ?? null };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.podiatryReception.delete({ where: { id } });
  }

  async upsertComplaint(id: string, dto: ComplaintDto) {
    await this.findOne(id);
    const data: any = {};
    const fields: (keyof ComplaintDto)[] = [
      'mainComplaint', 'startDate', 'possibleCause',
      'previousDoctor', 'previousTreatment',
      'symptomsBetterTime', 'symptomsWorseTime',
      'painType', 'painLevel', 'painTrend', 'hadInjuryBefore',
      'problemDescription', 'historyOfSymptoms',
      'affectedSide', 'footSymptoms', 'visitTypes',
      'vasScore', 'occupation', 'activities',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return this.prisma.podiatryReception.update({ where: { id }, data });
  }

  async upsertMedicalHistory(id: string, dto: MedicalHistoryDto) {
    await this.findOne(id);
    const data: any = {};
    const fields: (keyof MedicalHistoryDto)[] = [
      'height', 'weight',
      'currentMedications', 'previousDiagnoses',
      'herbalPreparations', 'herbalPreparationsDetails',
      'otherHealthProblems', 'doctorRestrictions',
      'smoker', 'everSmoked', 'smokingFrequency',
      'hasPacemaker', 'isPregnant', 'allergyToAdhesives',
      'surgeries',
      'hadPhysicalTherapy', 'hasOtherTreatments',
      'diagnosis',
      'imagingProcedures',
      'radiographyTypes', 'radiographyOther', 'radiographyResults',
      'hasNewAnalysis', 'newAnalysisDate', 'newAnalysisNotes',
      'hasOldAnalysis', 'oldAnalysisDate', 'oldAnalysisNotes',
      'boneDensityScan', 'hospitalizedPastYear',
      'medicalHistory', 'medicalHistoryOther',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return this.prisma.podiatryReception.update({ where: { id }, data });
  }
}
