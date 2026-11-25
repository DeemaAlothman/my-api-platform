import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { DoctorAssessmentDto } from './dto/doctor-assessment.dto';
import { PhysioAssessmentDto } from './dto/physio-assessment.dto';
import { ProsthetistOpinionDto } from './dto/prosthetist-opinion.dto';
import { AssignPractitionersDto } from './dto/assign-practitioners.dto';
import { CreateMeasurementSheetDto } from './dto/create-measurement-sheet.dto';
import { AddComponentDto } from './dto/add-component.dto';

const PATIENTS_URL   = process.env.PATIENTS_SERVICE_URL   || 'http://patients:4010';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const WAREHOUSE_URL  = process.env.WAREHOUSE_SERVICE_URL  || 'http://warehouse:4018';

// حالات الاستقبال بترتيبها — الحالة تتقدّم فقط ولا ترجع للخلف
export const RECEPTION_STATUSES = ['IN_EXAMINATION', 'EXAMINED', 'MEASURED', 'DELIVERED'] as const;
export type ReceptionStatus = (typeof RECEPTION_STATUSES)[number];
const STATUS_RANK: Record<string, number> = Object.fromEntries(RECEPTION_STATUSES.map((s, i) => [s, i]));

const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const hasItems = (v: unknown) => Array.isArray(v) && v.some((x) => hasText(x));

/**
 * اكتمال تاب «الأطراف الصناعية»: رأي أخصائي الأطراف معبّأ، والتاريخ السريري فيه
 * واحد على الأقل من: قصة الولادة، التاريخ المرضي، الأهداف الوظيفية، الأجهزة الموصى بها.
 */
export function isProstheticsTabComplete(r: {
  prosthetistOpinion?: string | null; birthHistory?: string | null; medicalHistory?: string | null;
  functionalGoals?: string[] | null; recommendedDeviceTypes?: string[] | null;
}): boolean {
  const clinicalHistory =
    hasText(r.birthHistory) || hasText(r.medicalHistory) ||
    hasItems(r.functionalGoals) || hasItems(r.recommendedDeviceTypes);
  return hasText(r.prosthetistOpinion) && clinicalHistory;
}

@Injectable()
export class ReceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── حالة الاستقبال ───────────────────────────────────────────────────

  /**
   * يقدّم الحالة إلى target إن كانت الحالية أقل منها، وإلا لا يفعل شيئاً (لا رجوع للخلف).
   * التحديث مشروط بالحالة المقروءة، فطلبان متزامنان لا يُرجعان الحالة للخلف.
   * يُسجَّل كل تغيير فعلي بسجل التدقيق. يرجّع الحالة بعد العملية.
   */
  private async advanceStatus(
    id: string, target: ReceptionStatus, trigger: string, userId?: string | null, attempt = 0,
  ): Promise<string> {
    const row = await this.prisma.orthoticsReception.findFirst({ where: { id }, select: { status: true } });
    if (!row) return target;
    const from = row.status;
    if ((STATUS_RANK[from] ?? -1) >= STATUS_RANK[target]) return from;

    const res = await this.prisma.orthoticsReception.updateMany({
      where: { id, status: from },
      data: { status: target },
    });
    if (res.count === 0) {
      // تغيّرت الحالة بين القراءة والكتابة — نعيد المحاولة على القيمة الجديدة (حد أقصى 3)
      return attempt < 3 ? this.advanceStatus(id, target, trigger, userId, attempt + 1) : from;
    }
    await this.logStatusChange(id, from, target, trigger, userId);
    return target;
  }

  private async logStatusChange(id: string, from: string, to: string, trigger: string, userId?: string | null) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, ip, metadata, "createdAt")
       VALUES ($1, NULL, 'ORTHOTICS_RECEPTION_STATUS_CHANGED', 'orthotics_receptions', $2, 'SYSTEM', $3, NULL, $4::jsonb, NOW())`,
      userId ?? null, id, `/api/v1/orthotics/receptions/${id}`,
      JSON.stringify({ from, to, trigger }),
    ).catch(() => { /* فشل التدقيق ما بيوقف العملية */ });
  }

  /** يُستدعى بعد حفظ تقييم الطبيب أو رأي أخصائي الأطراف — الشرط يعتمد على القسمين معاً */
  private async checkExamined(id: string, trigger: string, userId?: string | null): Promise<string | null> {
    const r = await this.prisma.orthoticsReception.findFirst({ where: { id } });
    if (!r) return null;
    if (!isProstheticsTabComplete(r)) return r.status;
    return this.advanceStatus(id, 'EXAMINED', trigger, userId);
  }

  async deliver(id: string, userId: string) {
    const r = await this.findReceptionOrThrow(id);
    if (r.status === 'DELIVERED') throw new BadRequestException('تم تسليم هذا الاستقبال مسبقاً');
    if (r.status !== 'MEASURED') {
      throw new BadRequestException('لا يمكن التسليم قبل أخذ القياس — يجب أن تكون الحالة «أُخذ القياس»');
    }
    // مشروط بـ MEASURED حتى لا يُسلَّم مرتين بطلبين متزامنين
    const res = await this.prisma.orthoticsReception.updateMany({
      where: { id, status: 'MEASURED', deletedAt: null },
      data: { status: 'DELIVERED', deliveredAt: new Date(), deliveredBy: userId },
    });
    if (res.count === 0) throw new BadRequestException('تغيّرت حالة الاستقبال — أعد تحميل الصفحة');
    await this.logStatusChange(id, 'MEASURED', 'DELIVERED', 'DELIVER_BUTTON', userId);
    return this.findOne(id);
  }

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
  async findAll(patientId?: string, isSuitable?: string, status?: string) {
    const where: any = { deletedAt: null };
    if (patientId) where.patientId = patientId;
    if (status) {
      if (!(RECEPTION_STATUSES as readonly string[]).includes(status)) {
        throw new BadRequestException(`حالة غير معروفة: ${status} — القيم المسموحة: ${RECEPTION_STATUSES.join('، ')}`);
      }
      where.status = status;
    }
    if (isSuitable === 'true') where.isSuitable = true;
    else if (isSuitable === 'false') where.isSuitable = false;
    else if (isSuitable === 'undecided') where.isSuitable = null;

    const receptions = await this.prisma.orthoticsReception.findMany({
      where,
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
    const reception = await this.prisma.orthoticsReception.findFirst({ where: { id, deletedAt: null } });
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
    'deliveredBy',
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
    const reception = await this.prisma.orthoticsReception.findFirst({ where: { id, deletedAt: null } });
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

  // حذف ناعم لا نهائي: الصف يبقى في قاعدة البيانات مع وقت الحذف ومنفّذه،
  // والمرفقات تبقى معه (الحذف النهائي كان يسحبها بـCascade بلا رجعة).
  async remove(id: string, userId?: string) {
    await this.findOne(id);
    return this.prisma.orthoticsReception.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId ?? null },
    });
  }

  // ── تقييم طبيب العظمية ──────────────────────────────────────────────

  async upsertDoctorAssessment(id: string, dto: DoctorAssessmentDto, userId: string) {
    const current = await this.findOne(id);

    // عدد المقومات وتفاصيلها وجهان لمعلومة واحدة: العدد يحدّد كم سطراً يفتح في
    // الواجهة. فلو اختلفا صار في الملف عددٌ لا يطابق ما عُبِّئ فعلاً.
    //
    // تُقارَن القيمة المرسَلة بالمحفوظة إن لم تُرسَل، فتعديل أحدهما وحده يُفحص
    // مقابل الآخر كما هو في الملف.
    const nextCount = dto.appliancesCount ?? (current as any).appliancesCount ?? null;
    const nextDetails = dto.appliancesDetails ?? ((current as any).appliancesDetails as any[] | null);
    if (nextCount !== null && Array.isArray(nextDetails) && nextDetails.length !== nextCount) {
      throw new BadRequestException({
        code: 'APPLIANCES_COUNT_MISMATCH',
        message: `عدد المقومات (${nextCount}) لا يطابق عدد الأسطر المعبّأة (${nextDetails.length})`,
        details: [{ appliancesCount: nextCount, detailsLength: nextDetails.length }],
      });
    }

    const data: any = { doctorAssessmentUpdatedAt: new Date(), doctorAssessmentUpdatedBy: userId };
    const fields: (keyof DoctorAssessmentDto)[] = [
      'diagnosisTypes', 'cerebralPalsyType', 'footDropCause', 'diagnosisOther',
      'injuryStartDate', 'surgicalHistory', 'familyHistory', 'chiefComplaint',
      'amputationCause', 'amputationCauseOtherDetail',
      'appliancesCount', 'appliancesDetails',
      'affectedLimbType', 'affectedSide', 'soundLimbDescription',
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
    const updated = await this.prisma.orthoticsReception.update({ where: { id }, data });
    const status = await this.checkExamined(id, 'DOCTOR_ASSESSMENT_SAVED', userId);
    return { ...updated, status: status ?? updated.status };
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

    const updated = await this.prisma.orthoticsReception.update({ where: { id }, data });
    const status = await this.checkExamined(id, 'PROSTHETIST_OPINION_SAVED', userId);
    return { ...updated, status: status ?? updated.status };
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
      where: { practitionerIds: { has: practitionerId }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const patientMap = await this.resolvePatients(receptions.map((r) => r.patientId));
    return receptions.map((r) => ({ ...r, patient: patientMap[r.patientId] ?? null }));
  }

  // ── قطع العرض الفني ──────────────────────────────────────────────────
  //
  // القطع للاستقبال كلّه لا لكل مقوّم: الاستقبال الواحد قد يحمل مقوّمين أو أكثر
  // (يمين/يسار وأنواعاً مختلفة) وتُشترى قطعُها معاً — كما في حالات الأطراف.

  private async resolveDefaultWarehouseId(): Promise<string | undefined> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM warehouse.warehouses WHERE code = 'WH-MAIN' AND "isActive" = true LIMIT 1`,
    ).catch(() => [] as Array<{ id: string }>);
    return rows[0]?.id;
  }

  async addComponent(receptionId: string, dto: AddComponentDto, userId: string) {
    await this.findReceptionOrThrow(receptionId);

    let partCode = dto.partCode ?? null;
    let partName = dto.partName ?? null;
    let warehouseItem: { name: string | null; nameAr: string | null; partCode: string | null } | null = null;

    if (dto.warehouseItemId) {
      // الكود والاسم يُقرآن من الكتالوج لا مما أُرسل: الصنف الواحد يجب أن يحمل
      // الاسم نفسه أينما ذُكر، وإلا تفرّق الاسم على القطعة الواحدة بين الأقسام.
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        partCode: string | null; sku: string; name: string | null; nameAr: string | null;
      }>>(
        `SELECT "partCode", sku, name, "nameAr" FROM warehouse.items
         WHERE id = $1 AND "isActive" = true AND "deletedAt" IS NULL LIMIT 1`,
        dto.warehouseItemId,
      ).catch(() => [] as any[]);
      const item = rows[0];
      if (!item) {
        throw new BadRequestException({
          code: 'WAREHOUSE_ITEM_NOT_FOUND',
          message: 'صنف المستودع غير موجود',
        });
      }
      partCode = item.partCode || item.sku;
      partName = item.name || item.nameAr || dto.partName || partCode;
      warehouseItem = { name: item.name, nameAr: item.nameAr, partCode };
    }

    if (!partCode || !partName) {
      throw new BadRequestException({
        code: 'PART_CODE_NAME_REQUIRED',
        message: 'أدخل كود القطعة واسمها، أو اختر صنفاً من المستودع',
      });
    }

    const component = await this.prisma.orthoticsComponent.create({
      data: {
        receptionId,
        partCode,
        partName,
        supplier: dto.supplier,
        sourceLocation: dto.sourceLocation,
        warehouseItemId: dto.warehouseItemId ?? null,
        addedBy: userId,
      },
    });

    // طلب المواد اختياري وغير حاجب: القطعة تُحفظ وإن تعذّر فتحه، فلا يضيع عمل
    // الفنّي لأن خدمة المستودع لم تستجب.
    let materialRequest: { materialRequestId: string; status: string } | null = null;
    if (dto.warehouseItemId) {
      try {
        const warehouseId = dto.warehouseId ?? await this.resolveDefaultWarehouseId();
        const res = await fetch(
          `${WAREHOUSE_URL}/api/v1/warehouse/material-requests/internal/from-part-code`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
            body: JSON.stringify({
              partCode,
              quantity: 1,
              warehouseId,
              referenceType: 'ORTHOTICS_RECEPTION',
              referenceId: receptionId,
              requestedByUserId: userId,
            }),
          },
        );
        const json: any = await res.json().catch(() => null);
        if (json?.data?.matched) {
          await this.prisma.orthoticsComponent.update({
            where: { id: component.id },
            data: { materialRequestId: json.data.materialRequestId },
          });
          (component as any).materialRequestId = json.data.materialRequestId;
          materialRequest = {
            materialRequestId: json.data.materialRequestId,
            status: json.data.status,
          };
        }
      } catch { /* طلب المواد اختياري — فشله لا يكسر حفظ القطعة */ }
    }

    const names = await this.resolveActorNames([userId]);
    return {
      ...component,
      warehouseItem,
      materialRequest,
      addedByName: names[userId] ?? null,
    };
  }

  async getComponents(receptionId: string) {
    await this.findReceptionOrThrow(receptionId);
    const components = await this.prisma.orthoticsComponent.findMany({
      where: { receptionId },
      orderBy: { addedAt: 'desc' },
    });
    if (components.length === 0) return [];

    const warehouseItemIds = [...new Set(
      components.map((c) => c.warehouseItemId).filter(Boolean) as string[],
    )];
    const warehouseMap = new Map<string, { name: string | null; nameAr: string | null; partCode: string | null }>();
    if (warehouseItemIds.length) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: string; name: string | null; nameAr: string | null; partCode: string | null;
      }>>(
        `SELECT id, name, "nameAr", "partCode" FROM warehouse.items WHERE id = ANY($1::text[])`,
        warehouseItemIds,
      ).catch(() => [] as any[]);
      for (const r of rows) warehouseMap.set(r.id, r);
    }

    // حالة طلب المواد تُقرأ لحظة العرض: الطلب يتقدّم في خدمة المستودع بعد فتحه،
    // فنسخُ حالته عند الإنشاء كان سيُجمّدها على أول قيمة.
    const requestIds = [...new Set(
      components.map((c) => c.materialRequestId).filter(Boolean) as string[],
    )];
    const requestMap = new Map<string, string>();
    if (requestIds.length) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; status: string | null }>>(
        `SELECT id, status::text AS status FROM warehouse.material_requests WHERE id = ANY($1::text[])`,
        requestIds,
      ).catch(() => [] as any[]);
      for (const r of rows) if (r.status) requestMap.set(r.id, r.status);
    }

    const names = await this.resolveActorNames(components.map((c) => c.addedBy));

    return components.map((c) => ({
      ...c,
      warehouseItem: c.warehouseItemId ? (warehouseMap.get(c.warehouseItemId) ?? null) : null,
      materialRequest: c.materialRequestId
        ? { materialRequestId: c.materialRequestId, status: requestMap.get(c.materialRequestId) ?? null }
        : null,
      addedByName: names[c.addedBy] ?? null,
    }));
  }

  async removeComponent(receptionId: string, componentId: string) {
    await this.findReceptionOrThrow(receptionId);
    const component = await this.prisma.orthoticsComponent.findFirst({
      where: { id: componentId, receptionId },
    });
    if (!component) throw new NotFoundException('القطعة غير موجودة');
    return this.prisma.orthoticsComponent.delete({ where: { id: componentId } });
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

    const sheet = await this.prisma.orthoticsMeasurementSheet.create({
      data: {
        receptionId,
        sheet: dto.sheet,
        side: dto.side,
        notes: dto.notes ?? null,
        values: dto.values,
        createdBy: userId,
      },
    });
    // أول ورقة قياس ← «أُخذ القياس» مباشرة، حتى لو التاب مش مكتمل (الحالة = أبعد خطوة)
    const receptionStatus = await this.advanceStatus(receptionId, 'MEASURED', 'MEASUREMENT_SHEET_CREATED', userId);
    return { ...sheet, receptionStatus };
  }

  async getMeasurementSheets(receptionId: string, sheet?: string) {
    await this.findOne(receptionId);
    return this.prisma.orthoticsMeasurementSheet.findMany({
      where: { receptionId, ...(sheet ? { sheet } : {}) },
      orderBy: { examinedAt: 'desc' },
    });
  }
}
