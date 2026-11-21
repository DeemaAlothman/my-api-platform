import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { DoctorAssessmentDto } from './dto/doctor-assessment.dto';
import { PhysioAssessmentDto } from './dto/physio-assessment.dto';
import { ProsthetistOpinionDto } from './dto/prosthetist-opinion.dto';
import { AssignPractitionersDto } from './dto/assign-practitioners.dto';
import { CreateMeasurementSheetDto } from './dto/create-measurement-sheet.dto';

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

  // تحويل حالة معاينة طبيب (من خدمة physio) إلى استقبال مقومات جديد
  async createFromExam(patientId: string, specialistId: string | undefined, createdBy: string | undefined) {
    const reception = await this.prisma.orthoticsReception.create({
      data: {
        patientId,
        createdBy: createdBy || 'system',
        practitionerIds: specialistId ? [specialistId] : [],
      },
    });
    return { id: reception.id };
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

  // isSuitable: "true" أو "false"، وأي شيء آخر (أو غيابه) يعني الكل.
  // "undecided" تُرجِع ما لم يُقرَّر بعدُ — وهي ليست "غير مناسب".
  async findAll(patientId?: string, isSuitable?: string) {
    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (isSuitable === 'true') where.isSuitable = true;
    else if (isSuitable === 'false') where.isSuitable = false;
    else if (isSuitable === 'undecided') where.isSuitable = null;

    const receptions = await this.prisma.orthoticsReception.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: 'desc' },
    });
    const patientMap = await this.resolvePatients(receptions.map((r) => r.patientId));
    // استعلام أسماء واحد للصفحة كلها بدل استعلام لكل سطر
    const names = await this.resolveActorNames(
      receptions.flatMap((r) => ReceptionsService.ACTOR_FIELDS.map((f) => (r as any)[f])),
    );
    return receptions.map((r) =>
      this.attachActorNames({ ...r, patient: patientMap[r.patientId] ?? null }, names),
    );
  }

  // ── قرار المناسبة ─────────────────────────────────────────────────────────

  async setSuitability(
    id: string,
    dto: { isSuitable: boolean; suitabilityNote?: string; targetAppliancesCount?: number },
    userId: string,
  ) {
    await this.findReceptionOrThrow(id);
    return this.prisma.orthoticsReception.update({
      where: { id },
      data: {
        isSuitable: dto.isSuitable,
        suitabilityNote: dto.suitabilityNote,
        targetAppliancesCount: dto.targetAppliancesCount,
        suitabilityUpdatedAt: new Date(),
        suitabilityUpdatedBy: userId,
      },
    });
  }

  // ── جلسات المتابعة ────────────────────────────────────────────────────────

  private async findReceptionOrThrow(id: string) {
    const reception = await this.prisma.orthoticsReception.findUnique({ where: { id } });
    if (!reception) throw new NotFoundException('Reception not found');
    return reception;
  }

  async addFollowUp(
    receptionId: string,
    dto: { visitDate: string; findings: string; actions?: string; practitionerId?: string },
    userId: string,
  ) {
    await this.findReceptionOrThrow(receptionId);
    return this.prisma.orthoticsFollowUp.create({
      data: {
        receptionId,
        visitDate: new Date(dto.visitDate),
        findings: dto.findings,
        actions: dto.actions,
        practitionerId: dto.practitionerId || userId,
      },
    });
  }

  async getFollowUps(receptionId: string) {
    await this.findReceptionOrThrow(receptionId);
    const followUps = await this.prisma.orthoticsFollowUp.findMany({
      where: { receptionId },
      orderBy: { visitDate: 'desc' },
    });
    const names = await this.resolveActorNames(followUps.map((f) => f.practitionerId));
    return followUps.map((f) => ({
      ...f,
      practitionerName: names[f.practitionerId] ?? null,
    }));
  }

  // شرط receptionId في where يمنع تعديل جلسة تابعة لاستقبال آخر عبر تخمين معرّفها
  async updateFollowUp(
    receptionId: string,
    followUpId: string,
    dto: { visitDate?: string; findings?: string; actions?: string; practitionerId?: string },
  ) {
    const existing = await this.prisma.orthoticsFollowUp.findFirst({
      where: { id: followUpId, receptionId },
    });
    if (!existing) throw new NotFoundException('Follow-up not found');
    return this.prisma.orthoticsFollowUp.update({
      where: { id: followUpId },
      data: {
        visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
        findings: dto.findings,
        actions: dto.actions,
        practitionerId: dto.practitionerId,
      },
    });
  }

  async deleteFollowUp(receptionId: string, followUpId: string) {
    const existing = await this.prisma.orthoticsFollowUp.findFirst({
      where: { id: followUpId, receptionId },
    });
    if (!existing) throw new NotFoundException('Follow-up not found');
    await this.prisma.orthoticsFollowUp.delete({ where: { id: followUpId } });
    return { deleted: true };
  }

  // ── أسماء من عبّأ كل قسم ───────────────────────────────────────────────────

  // بعض الحقول تحمل userId (كاتب القسم) وبعضها employeeId (المعالج)، فالاستعلام
  // يطابق العمودين معاً ويفهرس النتيجة بالاثنين — فلا يهمّ أيّهما وصل.
  //
  // بلا شرط deletedAt عمداً: من غادر لاحقاً يجب أن يبقى اسمه على ما عبّأه.
  private async resolveActorNames(ids: Array<string | null | undefined>): Promise<Record<string, string>> {
    const unique = [...new Set(ids.filter(Boolean) as string[])];
    if (unique.length === 0) return {};
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; userId: string | null; name: string }>>(
      `SELECT e.id, e."userId", e."firstNameAr" || ' ' || e."lastNameAr" AS name
       FROM users.employees e
       WHERE e.id = ANY($1::text[]) OR e."userId" = ANY($1::text[])`,
      unique,
    ).catch(() => []);

    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.id] = row.name;
      if (row.userId) map[row.userId] = row.name;
    }
    return map;
  }

  // حقول «من عبّأ» على الاستقبال. كل واحد يرافقه `<name>Name` في الاستجابة.
  private static readonly ACTOR_FIELDS = [
    'createdBy',
    'doctorAssessmentUpdatedBy',
    'physioAssessmentUpdatedBy',
    'prosthetistOpinionUpdatedBy',
    'suitabilityUpdatedBy',
  ] as const;

  private attachActorNames<T extends Record<string, any>>(reception: T, names: Record<string, string>): T {
    const extra: Record<string, string | null> = {};
    for (const field of ReceptionsService.ACTOR_FIELDS) {
      const id = reception[field];
      extra[`${field}Name`] = id ? names[id] ?? null : null;
    }
    return { ...reception, ...extra };
  }

  async findOne(id: string) {
    const reception = await this.prisma.orthoticsReception.findUnique({ where: { id } });
    if (!reception) throw new NotFoundException('Reception not found');
    const patientMap = await this.resolvePatients([reception.patientId]);
    const names = await this.resolveActorNames(
      ReceptionsService.ACTOR_FIELDS.map((f) => (reception as any)[f]),
    );
    return this.attachActorNames(
      { ...reception, patient: patientMap[reception.patientId] ?? null },
      names,
    );
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
      'muscleTone', 'spasticityLevel', 'muscleToneDetails', 'sensation', 'sensationDetails',
      'thighMuscleStrength', 'legFootMuscleStrength',
      'upperArmMuscleStrength', 'forearmMuscleStrength',
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
      'hipROM', 'kneeROM', 'ankleROM', 'wristROM', 'elbowROM',
      'muscleStrengthMovements', 'muscleStrengthGrades',
      'deformityFlexibility', 'deformityStatus',
      'trunkStrengthMovements', 'trunkStrengthGrades',
      'trunkControlSitting', 'trunkBalanceDynamicSitting',
      'trunkControlStanding', 'trunkBalanceStaticStanding', 'trunkBalanceDynamicStanding',
      'activityLevel',
      'dailyWearHours',
      'physioOpinion',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return this.prisma.orthoticsReception.update({ where: { id }, data });
  }

  // ── رأي أخصائي الأطراف الصناعية ──────────────────────────────────────

  private static readonly DEVICE_TYPES = ['AFO', 'KAFO', 'ORTHOSIS_WITH_FES', 'OTHER'];

  async upsertProsthetistOpinion(id: string, dto: ProsthetistOpinionDto, userId?: string) {
    await this.findOne(id);
    const data: any = {
      prosthetistOpinionUpdatedAt: new Date(),
      prosthetistOpinionUpdatedBy: userId ?? null,
    };
    const fields: (keyof ProsthetistOpinionDto)[] = [
      'recommendedDeviceTypes', 'recommendedDeviceOther', 'additionalNotes',
      'prosthetistOpinion',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }

    // عدد الأجهزة المطلوبة من كل نوع — قيمة يحددها المستخدم، تستبدل الكائن القديم بالكامل
    if (dto.deviceUsageCounts !== undefined) {
      const counts: Record<string, number> = {};
      for (const [deviceType, count] of Object.entries(dto.deviceUsageCounts)) {
        if (!ReceptionsService.DEVICE_TYPES.includes(deviceType)) {
          throw new BadRequestException(`نوع جهاز غير معروف: ${deviceType}`);
        }
        if (!Number.isInteger(count) || count < 0) {
          throw new BadRequestException(`قيمة غير صالحة لـ ${deviceType} — يجب أن تكون عدداً صحيحاً ≥ 0`);
        }
        counts[deviceType] = count;
      }
      data.deviceUsageCounts = counts;
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

  // ── أوراق قياس المقومات ──────────────────────────────────────────────
  // أسماء الخانات مأخوذة من الرسمات (SVG) عند الفرونت — لا تتغير بدون تنسيق معهم

  private static readonly MEASUREMENT_SHEET_FIELDS: Record<string, string[]> = {
    BELOW_KNEE: [
      'circ_01', 'circ_02', 'circ_03', 'circ_04', 'circ_05', 'circ_06', 'circ_07',
      'len_01', 'len_02', 'len_03', 'len_04', 'len_05', 'len_06', 'len_07',
      'len_08', 'len_09', 'len_10', 'len_11', 'len_12', 'len_13',
    ],
    FULL_LEG: [
      'circ_01', 'circ_02', 'circ_03', 'circ_04', 'circ_05', 'circ_06',
      'len_01', 'len_02', 'len_03', 'len_04', 'len_05', 'len_06', 'len_07', 'len_08', 'len_09',
      'len_10', 'len_11', 'len_12', 'len_13', 'len_14', 'len_15', 'len_16', 'len_17', 'len_18',
    ],
    FOOT_ACCESSORIES: ['len_01', 'len_02', 'len_03', 'len_04', 'len_05'],
  };

  async addMeasurementSheet(receptionId: string, dto: CreateMeasurementSheetDto, userId: string) {
    await this.findOne(receptionId);

    const allowedKeys = ReceptionsService.MEASUREMENT_SHEET_FIELDS[dto.sheet];
    if (!allowedKeys) {
      throw new BadRequestException(`نموذج غير معروف: ${dto.sheet}`);
    }

    const entries = Object.entries(dto.values ?? {});
    if (entries.length === 0) {
      throw new BadRequestException('يجب إدخال خانة واحدة على الأقل');
    }
    for (const [key, value] of entries) {
      if (!allowedKeys.includes(key)) {
        throw new BadRequestException(`الخانة "${key}" غير موجودة بنموذج ${dto.sheet}`);
      }
      if (typeof value !== 'string') {
        throw new BadRequestException(`قيمة الخانة "${key}" يجب أن تكون نصاً`);
      }
    }

    return this.prisma.orthoticsMeasurementSheet.create({
      data: {
        receptionId,
        sheet: dto.sheet,
        side: dto.side,
        notes: dto.notes ?? null,
        values: dto.values,
        createdBy: userId,
      },
    });
  }

  async getMeasurementSheets(receptionId: string, sheet?: string) {
    await this.findOne(receptionId);
    return this.prisma.orthoticsMeasurementSheet.findMany({
      where: { receptionId, ...(sheet ? { sheet } : {}) },
      orderBy: { examinedAt: 'desc' },
    });
  }
}
