import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { DoctorAssessmentDto } from './dto/doctor-assessment.dto';
import { PhysioAssessmentDto } from './dto/physio-assessment.dto';
import { ProsthetistOpinionDto } from './dto/prosthetist-opinion.dto';
import { AssignPractitionersDto } from './dto/assign-practitioners.dto';

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
    const reception = await this.prisma.orthoticsReception.create({
      data: {
        patientId:        dto.patientId,
        guardianName:     dto.guardianName ?? null,
        guardianRelation: dto.guardianRelation ?? null,
        guardianPhone:    dto.guardianPhone ?? null,
        createdBy:        userId,
      },
    });
    const patientMap = await this.resolvePatients([reception.patientId]);
    return { ...reception, patient: patientMap[reception.patientId] ?? null };
  }

  async findAll(patientId?: string) {
    const receptions = await this.prisma.orthoticsReception.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    const patientMap = await this.resolvePatients(receptions.map((r) => r.patientId));
    return receptions.map((r) => ({ ...r, patient: patientMap[r.patientId] ?? null }));
  }

  async findOne(id: string) {
    const reception = await this.prisma.orthoticsReception.findUnique({ where: { id } });
    if (!reception) throw new NotFoundException('Reception not found');
    const patientMap = await this.resolvePatients([reception.patientId]);
    return { ...reception, patient: patientMap[reception.patientId] ?? null };
  }

  async update(id: string, dto: UpdateReceptionDto) {
    await this.findOne(id);
    const reception = await this.prisma.orthoticsReception.update({
      where: { id },
      data: {
        ...(dto.guardianName     !== undefined && { guardianName: dto.guardianName }),
        ...(dto.guardianRelation !== undefined && { guardianRelation: dto.guardianRelation }),
        ...(dto.guardianPhone    !== undefined && { guardianPhone: dto.guardianPhone }),
      },
    });
    const patientMap = await this.resolvePatients([reception.patientId]);
    return { ...reception, patient: patientMap[reception.patientId] ?? null };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.orthoticsReception.delete({ where: { id } });
  }

  // ── تقييم طبيب العظمية ──────────────────────────────────────────────

  async upsertDoctorAssessment(id: string, dto: DoctorAssessmentDto, userId: string) {
    await this.findOne(id);
    const data: any = { doctorAssessmentUpdatedAt: new Date(), doctorAssessmentUpdatedBy: userId };
    const fields: (keyof DoctorAssessmentDto)[] = [
      'diagnosisTypes', 'cerebralPalsyType', 'footDropCause', 'diagnosisOther',
      'injuryStartDate', 'surgicalHistory', 'familyHistory', 'chiefComplaint',
      'appliancesCount', 'affectedLimbType', 'affectedSide', 'soundLimbDescription',
      'muscleTone', 'spasticityLevel', 'sensation',
      'thighMuscleStrength', 'legFootMuscleStrength',
      'skinConditions', 'pressurePointsLocation',
      'birthHistory', 'previousOrthosisUse', 'previousOrthosisDetails', 'medicalHistory',
      'functionalGoals', 'dailyUseSettings', 'dailyUseOther',
      'doctorOpinion',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return this.prisma.orthoticsReception.update({ where: { id }, data });
  }

  // ── تقييم أخصائي العلاج الفيزيائي ───────────────────────────────────

  async upsertPhysioAssessment(id: string, dto: PhysioAssessmentDto, userId: string) {
    await this.findOne(id);
    const data: any = { physioAssessmentUpdatedAt: new Date(), physioAssessmentUpdatedBy: userId };
    const fields: (keyof PhysioAssessmentDto)[] = [
      'mobilityLevel', 'assistiveDevices', 'gaitProblems',
      'hipROM', 'kneeROM', 'ankleROM',
      'muscleStrengthMovements', 'deformityFlexibility', 'deformityStatus',
      'trunkStrengthMovements',
      'trunkControlSitting', 'trunkBalanceDynamicSitting',
      'trunkControlStanding', 'trunkBalanceStaticStanding', 'trunkBalanceDynamicStanding',
      'activityLevel',
      'physioOpinion',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return this.prisma.orthoticsReception.update({ where: { id }, data });
  }

  // ── رأي أخصائي الأطراف الصناعية ──────────────────────────────────────

  async upsertProsthetistOpinion(id: string, dto: ProsthetistOpinionDto) {
    await this.findOne(id);
    const data: any = {};
    const fields: (keyof ProsthetistOpinionDto)[] = [
      'recommendedDeviceTypes', 'recommendedDeviceOther', 'dailyWearHours', 'additionalNotes',
      'prosthetistOpinion',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return this.prisma.orthoticsReception.update({ where: { id }, data });
  }

  // ── فريق المعالجين ────────────────────────────────────────────────────────

  async resolveEmployeeIdByUserId(userId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      userId,
    ).catch(() => []);
    return rows[0]?.id ?? null;
  }

  private async notifyNewPractitioners(receptionId: string, patientId: string, employeeIds: string[]) {
    if (employeeIds.length === 0) return;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; userId: string | null }>>(
      `SELECT id, "userId" FROM users.employees WHERE id = ANY($1) AND "deletedAt" IS NULL`,
      employeeIds,
    ).catch(() => []);
    const payload = { receptionId, patientId };
    for (const row of rows) {
      if (!row.userId) continue;
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
        row.userId,
        'تم تكليفك بحالة جديدة',
        'تم تعيينك كمعالج مسؤول عن حالة مريض بقسم المقومات',
        JSON.stringify(payload),
      ).catch(() => {});
    }
  }

  async assignPractitioners(id: string, dto: AssignPractitionersDto) {
    const reception = await this.findOne(id);
    const before = new Set(reception.practitionerIds);
    const newlyAdded = dto.practitionerIds.filter((pid) => !before.has(pid));

    const updated = await this.prisma.orthoticsReception.update({
      where: { id },
      data: { practitionerIds: dto.practitionerIds },
    });

    await this.notifyNewPractitioners(id, updated.patientId, newlyAdded);
    return updated;
  }

  async findMyPatients(practitionerId: string) {
    const receptions = await this.prisma.orthoticsReception.findMany({
      where: { practitionerIds: { has: practitionerId } },
      orderBy: { createdAt: 'desc' },
    });
    const patientMap = await this.resolvePatients(receptions.map((r) => r.patientId));
    return receptions.map((r) => ({ ...r, patient: patientMap[r.patientId] ?? null }));
  }

  // ── Attachments ──────────────────────────────────────────────────────

  async addAttachment(receptionId: string, file: Express.Multer.File, userId: string) {
    if (!file) throw new BadRequestException('لم يتم رفع أي ملف');
    await this.findOne(receptionId);

    return this.prisma.orthoticsAttachment.create({
      data: {
        receptionId,
        fileUrl: (file as any).path,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
      },
    });
  }

  async getAttachments(receptionId: string) {
    await this.findOne(receptionId);
    return this.prisma.orthoticsAttachment.findMany({
      where: { receptionId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getAttachmentForDownload(receptionId: string, attachmentId: string) {
    const att = await this.prisma.orthoticsAttachment.findFirst({
      where: { id: attachmentId, receptionId },
    });
    if (!att) throw new NotFoundException('المرفق غير موجود');
    return att;
  }

  async deleteAttachment(receptionId: string, attachmentId: string) {
    const att = await this.prisma.orthoticsAttachment.findFirst({
      where: { id: attachmentId, receptionId },
    });
    if (!att) throw new NotFoundException('المرفق غير موجود');
    await this.prisma.orthoticsAttachment.delete({ where: { id: attachmentId } });
    return { message: 'تم حذف المرفق' };
  }
}
