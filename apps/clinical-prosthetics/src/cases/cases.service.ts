import {
  Injectable, NotFoundException, BadRequestException,
  InternalServerErrorException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto, UpdateCaseDto, UpdateStatusDto, ListCasesQueryDto } from './dto/case.dto';
import { UpperLimbAssessmentDto, LowerLimbAssessmentDto, AnkleDisarticulationAssessmentDto, KneeDisarticulationAssessmentDto, TransfemoralAssessmentDto, TranstibialAssessmentDto, HemipelvectomyAssessmentDto, TransradialAssessmentDto, ElbowDisarticulationAssessmentDto, TranshumeralAssessmentDto } from './dto/assessment.dto';
import { CommitteeOpinionDto, CommitteeDecideDto, CommitteeSignDto } from './dto/committee.dto';
import {
  AddComponentDto, GaitAnalysisDto, BalanceAssessmentDto,
  TreatmentPlanDto, WorkshopSessionDto, PtSessionDto, MediaSessionDto, ConsumableDto,
  PatientTreatmentProgramDto, PatientReviewProgramDto,
  ProstheticDeliveryFormDto, ProstheticDeliveryItemDto,
  BalanceAssessmentFormDto, GaitAnalysisFormDto,
  CaseTreatmentProgramDto,
} from './dto/treatment.dto';
import {
  FinalEvaluationDto, DirectorSignDto, DeliveryDto,
  PatientSignDto, ManagerSignDto, FollowUpDto, GaitSignDto,
} from './dto/delivery.dto';

const PATIENTS_URL = process.env.PATIENTS_SERVICE_URL || 'http://patients:4010';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  // جلب أسماء المرضى بالجملة من خدمة المرضى (فشل الاتصال لا يكسر الاستجابة)
  private async resolvePatientNames(
    patientIds: Array<string | null | undefined>,
  ): Promise<Record<string, { firstName: string; lastName: string; patientNumber: string; idNumber: string }>> {
    const ids = [...new Set(patientIds.filter(Boolean) as string[])];
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
        if (p?.id) {
          map[p.id] = {
            firstName: p.firstName,
            lastName: p.lastName,
            patientNumber: p.patientNumber,
            idNumber: p.idNumber,
          };
        }
      }
      return map;
    } catch {
      return {};
    }
  }

  // جلب أسماء الموظفين (معالج فيزيائي/فني أطراف/مشرف) بالجملة عبر استعلام مباشر لقاعدة users
  private async resolveEmployeeNames(
    employeeIds: Array<string | null | undefined>,
  ): Promise<Record<string, { firstNameAr: string; lastNameAr: string; jobTitleAr: string | null }>> {
    const ids = [...new Set(employeeIds.filter(Boolean) as string[])];
    if (ids.length === 0) return {};
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: string; firstNameAr: string; lastNameAr: string; jobTitleAr: string | null;
    }>>(
      `SELECT e.id, e."firstNameAr", e."lastNameAr", jt."nameAr" as "jobTitleAr"
       FROM users.employees e
       LEFT JOIN users.job_titles jt ON jt.id = e."jobTitleId"
       WHERE e.id = ANY($1::text[]) AND e."deletedAt" IS NULL`,
      ids,
    ).catch(() => [] as Array<{ id: string; firstNameAr: string; lastNameAr: string; jobTitleAr: string | null }>);
    const map: Record<string, { firstNameAr: string; lastNameAr: string; jobTitleAr: string | null }> = {};
    for (const r of rows) {
      map[r.id] = { firstNameAr: r.firstNameAr, lastNameAr: r.lastNameAr, jobTitleAr: r.jobTitleAr };
    }
    return map;
  }

  private async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.prostheticsCase.count();
    const num = String(count + 1).padStart(4, '0');
    return `PR-${year}-${num}`;
  }

  private async findCaseOrThrow(id: string) {
    const c = await this.prisma.prostheticsCase.findFirst({ where: { id, deletedAt: null } });
    if (!c) throw new NotFoundException('Prosthetics case not found');
    return c;
  }

  private readonly INVENTORY_MANAGER_IDS = [
    '415be69c-749b-41f5-a800-43b63baa794c',
    'f2297d60-1c06-44d7-b68d-cc5980affd37',
  ];

  private async notifyInventoryManagers(partCode: string, partName: string, caseId: string) {
    const msg = `طلب قطعة للحالة ${caseId}: ${partName} (${partCode}) — يرجى معالجة المخزون والاعتماد.`;
    for (const managerId of this.INVENTORY_MANAGER_IDS) {
      try {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications
             (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
           VALUES
             (gen_random_uuid(), $1, 'INVENTORY_REQUEST',
              'طلب قطعة — باطراف صناعية', 'Part Request — Prosthetics', $2, $3, false, NOW())`,
          managerId, msg, msg,
        );
      } catch (_) {}
    }
  }

  // ── Cases CRUD ────────────────────────────────────────────────────────────

  async create(dto: CreateCaseDto, userId: string) {
    const caseNumber = await this.generateCaseNumber();
    return this.prisma.prostheticsCase.create({
      data: {
        caseNumber,
        patientId: dto.patientId,
        amputationDate: dto.amputationDate ? new Date(dto.amputationDate) : null,
        amputationCause: dto.amputationCause as any,
        amputationCauseOtherDetail: dto.amputationCauseOtherDetail,
        amputationCount: dto.amputationCount,
        amputationType: dto.amputationType as any,
        amputationSide: dto.amputationSide as any,
        amputationLevel: dto.amputationLevel as any,
        moreAffectedSide: dto.moreAffectedSide as any,
        hasPreviousProsthesis: dto.hasPreviousProsthesis ?? false,
        previousProsthesisDetails: dto.previousProsthesisDetails,
        previousProsthesisWhen: dto.previousProsthesisWhen,
        previousProsthesisWhere: dto.previousProsthesisWhere,
        previousProsthesisType: dto.previousProsthesisType,
        hasRevisionSurgery: dto.hasRevisionSurgery ?? false,
        revisionDetails: dto.revisionDetails,
        hasPhysicalTherapy: dto.hasPhysicalTherapy ?? false,
        physicalTherapyDetails: dto.physicalTherapyDetails,
        hasChronicDiseases: dto.hasChronicDiseases ?? false,
        chronicDiseases: dto.chronicDiseases,
        currentlyUsingProsthesis: dto.currentlyUsingProsthesis,
        previouslyUsedProsthesis: dto.previouslyUsedProsthesis,
        previousProsthesisSystemDetail: dto.previousProsthesisSystemDetail,
        prosthetistId: dto.prosthetistId,
        physiotherapistId: dto.physiotherapistId,
        supervisingDoctorId: dto.supervisingDoctorId,
        workshopSupervisorId: dto.workshopSupervisorId,
        prosthesisType: dto.prosthesisType as any,
        prosthesisCompleted: dto.prosthesisCompleted ?? false,
        createdBy: userId,
      },
    });
  }

  async findAll(query: ListCasesQueryDto) {
    const { page = 1, limit = 20, patientId, status, amputationType, prosthetistId } = query;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (amputationType) where.amputationType = { has: amputationType };
    if (prosthetistId) where.prosthetistId = prosthetistId;

    const [items, total] = await Promise.all([
      this.prisma.prostheticsCase.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          upperAssessment: { select: { id: true, side: true, examinedAt: true } },
          lowerAssessment: { select: { id: true, side: true, examinedAt: true } },
          committeeReview: { select: { id: true, finalDecision: true } },
        },
      }),
      this.prisma.prostheticsCase.count({ where }),
    ]);
    const nameMap = await this.resolvePatientNames(items.map((i) => i.patientId));
    const enriched = items.map((i) => ({ ...i, patient: nameMap[i.patientId] ?? null }));
    return { items: enriched, total, page, limit };
  }

  async findOne(id: string) {
    const c = await this.prisma.prostheticsCase.findFirst({
      where: { id, deletedAt: null },
      include: {
        upperAssessment:                { orderBy: { examinedAt: 'desc' } },
        lowerAssessment:                { orderBy: { examinedAt: 'desc' } },
        ankleDisarticulationAssessment: { orderBy: { examinedAt: 'desc' } },
        kneeDisarticulationAssessment:  { orderBy: { examinedAt: 'desc' } },
        transfemoralAssessment:         { orderBy: { examinedAt: 'desc' } },
        transtibialAssessment:          { orderBy: { examinedAt: 'desc' } },
        hemipelvectomyAssessment:       { orderBy: { examinedAt: 'desc' } },
        transradialAssessment:          { orderBy: { examinedAt: 'desc' } },
        elbowDisarticulationAssessment: { orderBy: { examinedAt: 'desc' } },
        transhumeralAssessment:         { orderBy: { examinedAt: 'desc' } },
        committeeReview: true,
        components: { orderBy: { addedAt: 'desc' } },
        gaitAnalysis: true,
        balanceAssessment: true,
        treatmentPlan: {
          include: {
            workshopSessions: { orderBy: { sessionDate: 'asc' } },
            ptSessions: { orderBy: { sessionDate: 'asc' } },
            mediaSessions: { orderBy: { sessionDate: 'asc' } },
          },
        },
        consumables: { orderBy: { usedAt: 'desc' } },
        finalEvaluation: true,
        delivery: true,
        followUps: { orderBy: { visitDate: 'desc' } },
      },
    });
    if (!c) throw new NotFoundException('Prosthetics case not found');
    const nameMap = await this.resolvePatientNames([c.patientId]);
    const empMap = await this.resolveEmployeeNames([
      c.prosthetistId, c.physiotherapistId, c.supervisingDoctorId, c.workshopSupervisorId,
    ]);
    return {
      ...c,
      patient: nameMap[c.patientId] ?? null,
      prosthetist: c.prosthetistId ? (empMap[c.prosthetistId] ?? null) : null,
      physiotherapist: c.physiotherapistId ? (empMap[c.physiotherapistId] ?? null) : null,
      supervisingDoctor: c.supervisingDoctorId ? (empMap[c.supervisingDoctorId] ?? null) : null,
      workshopSupervisor: c.workshopSupervisorId ? (empMap[c.workshopSupervisorId] ?? null) : null,
    };
  }

  async update(id: string, dto: UpdateCaseDto) {
    await this.findCaseOrThrow(id);
    return this.prisma.prostheticsCase.update({
      where: { id },
      data: {
        amputationDate: dto.amputationDate ? new Date(dto.amputationDate) : undefined,
        amputationCause: dto.amputationCause as any,
        amputationCauseOtherDetail: dto.amputationCauseOtherDetail,
        amputationCount: dto.amputationCount,
        amputationType: dto.amputationType as any,
        amputationSide: dto.amputationSide as any,
        amputationLevel: dto.amputationLevel as any,
        moreAffectedSide: dto.moreAffectedSide as any,
        hasPreviousProsthesis: dto.hasPreviousProsthesis,
        previousProsthesisDetails: dto.previousProsthesisDetails,
        previousProsthesisWhen: dto.previousProsthesisWhen,
        previousProsthesisWhere: dto.previousProsthesisWhere,
        previousProsthesisType: dto.previousProsthesisType,
        hasRevisionSurgery: dto.hasRevisionSurgery,
        revisionDetails: dto.revisionDetails,
        hasPhysicalTherapy: dto.hasPhysicalTherapy,
        physicalTherapyDetails: dto.physicalTherapyDetails,
        hasChronicDiseases: dto.hasChronicDiseases,
        chronicDiseases: dto.chronicDiseases,
        currentlyUsingProsthesis: dto.currentlyUsingProsthesis,
        previouslyUsedProsthesis: dto.previouslyUsedProsthesis,
        previousProsthesisSystemDetail: dto.previousProsthesisSystemDetail,
        prosthetistId: dto.prosthetistId,
        physiotherapistId: dto.physiotherapistId,
        supervisingDoctorId: dto.supervisingDoctorId,
        workshopSupervisorId: dto.workshopSupervisorId,
        prosthesisType: dto.prosthesisType as any,
        prosthesisCompleted: dto.prosthesisCompleted,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    await this.findCaseOrThrow(id);
    return this.prisma.prostheticsCase.update({
      where: { id },
      data: { status: dto.status as any },
    });
  }

  async findByPatient(patientId: string) {
    const items = await this.prisma.prostheticsCase.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        committeeReview: { select: { finalDecision: true } },
        delivery: { select: { deliveryDate: true } },
      },
    });
    const nameMap = await this.resolvePatientNames([patientId]);
    return items.map((i) => ({ ...i, patient: nameMap[patientId] ?? null }));
  }

  // نقطة داخلية (خدمة-لخدمة): حذف ناعم لكل حالات الأطراف الصناعية لمريض محذوف
  async deleteByPatientInternal(patientId: string) {
    const result = await this.prisma.prostheticsCase.updateMany({
      where: { patientId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { deletedCount: result.count };
  }

  // ── Assessments ───────────────────────────────────────────────────────────

  async upsertUpperAssessment(caseId: string, dto: UpperLimbAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    return this.prisma.upperLimbAssessment.create({
      data: {
        caseId,
        side,
        residualLimbLength: dto.residualLimbLength as any,
        residualLimbShape: dto.residualLimbShape as any,
        residualLimbPhotoUrl: dto.residualLimbPhotoUrl,
        painPresent: dto.painPresent ?? false,
        painArea: dto.painArea,
        painIntensity: dto.painIntensity,
        painTypes: (dto.painTypes ?? []) as any,
        painTypeOtherDetail: dto.painTypeOtherDetail,
        phantomPainPresent: dto.phantomPainPresent ?? false,
        phantomPainIntensity: dto.phantomPainIntensity,
        residualLimbPalpable: dto.residualLimbPalpable,
        neuromaPalpable: dto.neuromaPalpable,
        skinAppearance: (dto.skinAppearance ?? []) as any,
        skinNotes: dto.skinNotes,
        skinColor: (dto.skinColor ?? []) as any,
        skinTemperature: dto.skinTemperature as any,
        scarCondition: (dto.scarCondition ?? []) as any,
        hasSkinGrafts: dto.hasSkinGrafts ?? false,
        graftArea: dto.graftArea,
        hasOtherAffectedLimbs: dto.hasOtherAffectedLimbs,
        canBalanceOneSide: dto.canBalanceOneSide,
        usesCompressionBandage: dto.usesCompressionBandage,
        jointsRangeOfMotion: dto.jointsRangeOfMotion as any,
        activityLevel: dto.activityLevel as any,
        romData: dto.romData,
        muscleMotionNotes: dto.muscleMotionNotes,
        examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
        examinerPhysioIds: dto.examinerPhysioIds ?? [],
        examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
      },
    });
  }

  async upsertLowerAssessment(caseId: string, dto: LowerLimbAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    const data: any = {
      residualLimbLength: dto.residualLimbLength as any,
      residualLimbShape: dto.residualLimbShape as any,
      residualLimbPhotoUrl: dto.residualLimbPhotoUrl,
      amputationLevelNote: dto.amputationLevelNote,
      painPresent: dto.painPresent ?? false,
      painArea: dto.painArea,
      painIntensity: dto.painIntensity,
      painTypes: (dto.painTypes ?? []) as any,
      painTypeOtherDetail: dto.painTypeOtherDetail,
      phantomPainPresent: dto.phantomPainPresent ?? false,
      phantomPainIntensity: dto.phantomPainIntensity,
      neuromaPalpable: dto.neuromaPalpable,
      loadTolerance: dto.loadTolerance as any,
      weightBearingLevel: dto.weightBearingLevel as any,
      notes: dto.notes,
      skinAppearance: (dto.skinAppearance ?? []) as any,
      skinColor: (dto.skinColor ?? []) as any,
      skinTemperature: dto.skinTemperature as any,
      scarCondition: (dto.scarCondition ?? []) as any,
      hasSkinGrafts: dto.hasSkinGrafts ?? false,
      graftArea: dto.graftArea,
      otherLimbCondition: dto.otherLimbCondition,
      usesAssistiveDevices: dto.usesAssistiveDevices ?? false,
      assistiveDeviceTypes: dto.assistiveDeviceTypes,
      canClimbStairs: dto.canClimbStairs,
      canBalanceOneSide: dto.canBalanceOneSide,
      jointsRangeOfMotion: dto.jointsRangeOfMotion as any,
      activityLevel: dto.activityLevel as any,
      romData: dto.romData,
      muscleMotionNotes: dto.muscleMotionNotes,
      examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
      examinerPhysioIds: dto.examinerPhysioIds ?? [],
      examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
    };
    return this.prisma.lowerLimbAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  async upsertTranshumeralAssessment(caseId: string, dto: TranshumeralAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    const data: any = {
      notes: dto.notes,
      soundLimb: dto.soundLimb ?? undefined,
      affectedLimb: dto.affectedLimb ?? undefined,
      examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
      examinerPhysioIds: dto.examinerPhysioIds ?? [],
      examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
    };
    return this.prisma.transhumeralAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  async upsertElbowDisarticulationAssessment(caseId: string, dto: ElbowDisarticulationAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    const data: any = {
      notes: dto.notes,
      soundLimb: dto.soundLimb ?? undefined,
      affectedLimb: dto.affectedLimb ?? undefined,
      examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
      examinerPhysioIds: dto.examinerPhysioIds ?? [],
      examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
    };
    return this.prisma.elbowDisarticulationAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  async upsertTransradialAssessment(caseId: string, dto: TransradialAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    const data: any = {
      notes: dto.notes,
      soundLimb: dto.soundLimb ?? undefined,
      affectedLimb: dto.affectedLimb ?? undefined,
      examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
      examinerPhysioIds: dto.examinerPhysioIds ?? [],
      examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
    };
    return this.prisma.transradialAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  async upsertHemipelvectomyAssessment(caseId: string, dto: HemipelvectomyAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    const data: any = {
      notes: dto.notes,
      footMeasurement: dto.footMeasurement,
      soundLimb: dto.soundLimb ?? undefined,
      affectedLimb: dto.affectedLimb ?? undefined,
      examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
      examinerPhysioIds: dto.examinerPhysioIds ?? [],
      examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
    };
    return this.prisma.hemipelvectomyAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  async upsertTranstibialAssessment(caseId: string, dto: TranstibialAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    const data: any = {
      notes: dto.notes,
      footMeasurement: dto.footMeasurement,
      soundLimb: dto.soundLimb ?? undefined,
      affectedLimb: dto.affectedLimb ?? undefined,
      examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
      examinerPhysioIds: dto.examinerPhysioIds ?? [],
      examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
    };
    return this.prisma.transtibialAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  async upsertTransfemoralAssessment(caseId: string, dto: TransfemoralAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    const data: any = {
      notes: dto.notes,
      footMeasurement: dto.footMeasurement,
      soundLimb: dto.soundLimb ?? undefined,
      affectedLimb: dto.affectedLimb ?? undefined,
      examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
      examinerPhysioIds: dto.examinerPhysioIds ?? [],
      examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
    };
    return this.prisma.transfemoralAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  async upsertKneeDisarticulationAssessment(caseId: string, dto: KneeDisarticulationAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    const data: any = {
      notes: dto.notes,
      footMeasurement: dto.footMeasurement,
      soundLimb: dto.soundLimb ?? undefined,
      affectedLimb: dto.affectedLimb ?? undefined,
      examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
      examinerPhysioIds: dto.examinerPhysioIds ?? [],
      examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
    };
    return this.prisma.kneeDisarticulationAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  async upsertAnkleDisarticulationAssessment(caseId: string, dto: AnkleDisarticulationAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const side = dto.side as any;
    const data: any = {
      notes: dto.notes,
      footMeasurement: dto.footMeasurement,
      soundLimb: dto.soundLimb ?? undefined,
      affectedLimb: dto.affectedLimb ?? undefined,
      examinerProsthetistIds: dto.examinerProsthetistIds ?? [],
      examinerPhysioIds: dto.examinerPhysioIds ?? [],
      examinerSupervisorIds: dto.examinerSupervisorIds ?? [],
    };
    return this.prisma.ankleDisarticulationAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  // ── Committee ─────────────────────────────────────────────────────────────

  async submitCommitteeOpinion(caseId: string, dto: CommitteeOpinionDto, userId: string) {
    await this.findCaseOrThrow(caseId);
    const now = new Date();
    const roleFieldMap: Record<string, any> = {
      PROSTHETIST:     { prosthetistOpinion: dto.opinion, prosthetistUserId: userId, prosthetistReviewedAt: now },
      PHYSIOTHERAPIST: { physiotherapistOpinion: dto.opinion, physiotherapistUserId: userId, physiotherapistReviewedAt: now },
      DOCTOR:          { doctorOpinion: dto.opinion, doctorUserId: userId, doctorReviewedAt: now },
      COMMITTEE_HEAD:  { committeeHeadOpinion: dto.opinion, committeeHeadUserId: userId, committeeHeadReviewedAt: now },
      EXPERT:          { expertOpinion: dto.opinion, expertUserId: userId, expertReviewedAt: now },
    };
    const updateData = roleFieldMap[dto.role];
    if (!updateData) throw new BadRequestException('Invalid committee role');

    return this.prisma.committeeReview.upsert({
      where: { caseId },
      create: { caseId, ...updateData },
      update: updateData,
    });
  }

  async committeeDecide(caseId: string, dto: CommitteeDecideDto, userId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.committeeReview.upsert({
      where: { caseId },
      create: {
        caseId,
        finalDecision: dto.decision as any,
        finalSummary: dto.finalSummary,
        decidedAt: new Date(),
      },
      update: {
        finalDecision: dto.decision as any,
        finalSummary: dto.finalSummary,
        decidedAt: new Date(),
      },
    });
  }

  async committeeSign(caseId: string, dto: CommitteeSignDto, userId: string, ip: string) {
    await this.findCaseOrThrow(caseId);
    const fieldsByRole: Record<string, any> = {
      DOCTOR: {
        doctorSignatureBase64: dto.signatureBase64,
        doctorSignedAt: new Date(),
        doctorSignatureIp: ip,
        doctorUserId: userId,
      },
      PROSTHETIST: {
        prosthetistSignatureBase64: dto.signatureBase64,
        prosthetistSignedAt: new Date(),
        prosthetistSignatureIp: ip,
      },
      PHYSIOTHERAPIST: {
        physiotherapistSignatureBase64: dto.signatureBase64,
        physiotherapistSignedAt: new Date(),
        physiotherapistSignatureIp: ip,
      },
    };
    const data = fieldsByRole[dto.role];
    if (!data) throw new BadRequestException('Invalid signer role');

    return this.prisma.committeeReview.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
  }

  async getCommitteePending(caseId: string) {
    const review = await this.prisma.committeeReview.findUnique({ where: { caseId } });
    const pending: string[] = [];
    if (!review) return { pending: ['PROSTHETIST', 'PHYSIOTHERAPIST', 'DOCTOR', 'COMMITTEE_HEAD'] };
    if (!review.prosthetistOpinion) pending.push('PROSTHETIST');
    if (!review.physiotherapistOpinion) pending.push('PHYSIOTHERAPIST');
    if (!review.doctorOpinion) pending.push('DOCTOR');
    if (!review.committeeHeadOpinion) pending.push('COMMITTEE_HEAD');
    if (!review.finalDecision) pending.push('FINAL_DECISION');
    if (!review.doctorSignatureBase64) pending.push('DOCTOR_SIGNATURE');
    if (!review.prosthetistSignatureBase64) pending.push('PROSTHETIST_SIGNATURE');
    if (!review.physiotherapistSignatureBase64) pending.push('PHYSIOTHERAPIST_SIGNATURE');
    return { pending };
  }

  // ── Components ────────────────────────────────────────────────────────────

  // يبحث عن صنف بالمخزون عبر كوده — قراءة فقط، عبر استعلام عابر للـ schema
  private async findInventoryItemIdByCode(code: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM clinic_inventory.inventory_items WHERE "partCode" = $1 AND "isActive" = true AND status IS NULL LIMIT 1`,
      code,
    ).catch(() => [] as Array<{ id: string }>);
    return rows[0]?.id ?? null;
  }

  async addComponent(caseId: string, dto: AddComponentDto, userId: string) {
    await this.findCaseOrThrow(caseId);

    // إذا ما انبعت inventoryItemId، نبحث تلقائياً بالكود. إذا ما لقينا تطابق، نحفظ بدون خصم من المخزون
    let inventoryItemId = dto.inventoryItemId ?? null;
    let matchedInInventory = true;
    if (!inventoryItemId) {
      inventoryItemId = await this.findInventoryItemIdByCode(dto.partCode);
      matchedInInventory = !!inventoryItemId;
    }

    const component = await this.prisma.prosthesisComponent.create({
      data: {
        caseId,
        inventoryItemId,
        partCode: dto.partCode,
        partName: dto.partName,
        supplier: dto.supplier,
        sourceLocation: dto.sourceLocation as any,
        reason: dto.reason,
        addedBy: userId,
      },
    });

    // إنشاء record طلب في المخزون (PENDING) مرتبط بالصنف الحقيقي دائماً
    // لو الـ inventoryItemId يشير لطلب سابق (status != null) نرجع للصنف الأصلي عبر linkedInventoryItemId
    if (inventoryItemId) {
      try {
        const rows = await this.prisma.$queryRawUnsafe<Array<{
          partCode: string; name: string; unit: string;
          status: string | null; linkedInventoryItemId: string | null;
        }>>(
          `SELECT "partCode", name, unit, status, "linkedInventoryItemId"
           FROM clinic_inventory.inventory_items WHERE id = $1 LIMIT 1`,
          inventoryItemId,
        );
        if (rows[0]) {
          // إذا كان الـ id يشير لطلب سابق → نستخدم الصنف الحقيقي
          const realItemId = rows[0].status !== null && rows[0].linkedInventoryItemId
            ? rows[0].linkedInventoryItemId
            : inventoryItemId;

          const realRows = realItemId !== inventoryItemId
            ? await this.prisma.$queryRawUnsafe<Array<{ partCode: string; name: string; unit: string }>>(
                `SELECT "partCode", name, unit FROM clinic_inventory.inventory_items WHERE id = $1 LIMIT 1`,
                realItemId,
              )
            : rows;

          const item = realRows[0] ?? rows[0];
          await this.prisma.$queryRawUnsafe(
            `INSERT INTO clinic_inventory.inventory_items
               (id, "partCode", name, unit, status, "requestedByUserId", "linkedInventoryItemId",
                "isActive", "currentStock", "createdAt", "updatedAt")
             VALUES
               (gen_random_uuid(), $1, $2, $3, 'PENDING', $4, $5, true, 0, NOW(), NOW())`,
            item.partCode, item.name, item.unit, userId, realItemId,
          );
        }
      } catch (_) {}
    }

    await this.notifyInventoryManagers(dto.partCode, dto.partName, caseId);

    return { ...component, matchedInInventory };
  }

  // إضافة عدة مكونات بنداء واحد (نفس منطق addComponent لكل عنصر)
  async addComponentsBulk(caseId: string, dtos: AddComponentDto[], userId: string) {
    await this.findCaseOrThrow(caseId);
    const results = [];
    for (const dto of dtos) {
      results.push(await this.addComponent(caseId, dto, userId));
    }
    return results;
  }

  async getComponents(caseId: string) {
    await this.findCaseOrThrow(caseId);
    const components = await this.prisma.prosthesisComponent.findMany({
      where: { caseId },
      orderBy: { addedAt: 'desc' },
    });

    // جلب حالة طلب المخزون لكل مكون مرتبط بـ inventoryItemId
    const itemIds = components.map((c: any) => c.inventoryItemId).filter(Boolean);
    if (!itemIds.length) return components;

    const requests = await this.prisma.$queryRawUnsafe<Array<{
      linkedInventoryItemId: string; status: string; id: string; notes: string | null;
    }>>(
      `SELECT id, "linkedInventoryItemId", status::text AS status, notes
       FROM clinic_inventory.inventory_items
       WHERE "linkedInventoryItemId" = ANY($1::text[])
         AND status IS NOT NULL
       ORDER BY "createdAt" DESC`,
      itemIds,
    ).catch(() => [] as any[]);

    // لكل مكون، نلاقي آخر طلب مرتبط فيه
    const requestMap = new Map<string, { status: string; requestId: string; notes: string | null }>();
    for (const r of requests) {
      if (!requestMap.has(r.linkedInventoryItemId)) {
        requestMap.set(r.linkedInventoryItemId, { status: r.status, requestId: r.id, notes: r.notes });
      }
    }

    return components.map((c: any) => ({
      ...c,
      inventoryRequest: c.inventoryItemId ? (requestMap.get(c.inventoryItemId) ?? null) : null,
    }));
  }

  async removeComponent(caseId: string, compId: string) {
    await this.findCaseOrThrow(caseId);
    const comp = await this.prisma.prosthesisComponent.findFirst({ where: { id: compId, caseId } });
    if (!comp) throw new NotFoundException('Component not found');
    return this.prisma.prosthesisComponent.delete({ where: { id: compId } });
  }

  // ── Gait Analysis ─────────────────────────────────────────────────────────

  async upsertGaitAnalysis(caseId: string, dto: GaitAnalysisDto) {
    await this.findCaseOrThrow(caseId);
    const data: any = {
      suspensionSystem: (dto.suspensionSystem ?? []) as any,
      socketBearing: dto.socketBearing as any,
      kneeJointType: dto.kneeJointType as any,
      footType: dto.footType as any,
      socketPain: dto.socketPain ?? false,
      residualLimbPain: dto.residualLimbPain ?? false,
      painIntensity: dto.painIntensity,
      alignmentCheck: dto.alignmentCheck as any,
      hasRomLimitations: dto.hasRomLimitations ?? false,
      hasHipFlexionContracture: dto.hasHipFlexionContracture ?? false,
      hasKneeFlexionContracture: dto.hasKneeFlexionContracture ?? false,
      weakHipAbductors: dto.weakHipAbductors ?? false,
      weakHipExtensors: dto.weakHipExtensors ?? false,
      weakTrunkMuscles: dto.weakTrunkMuscles ?? false,
      otherWeakness: dto.otherWeakness,
      trunkStability: dto.trunkStability as any,
      abdominalControl: dto.abdominalControl as any,
      pelvicControl: dto.pelvicControl as any,
      sittingBalance: dto.sittingBalance as any,
      standingBalance: dto.standingBalance as any,
      assistiveDevice: dto.assistiveDevice as any,
      speedMs: dto.speedMs,
      cadence: dto.cadence,
      stepLengthProsCm: dto.stepLengthProsCm,
      stepLengthSoundCm: dto.stepLengthSoundCm,
      stancePercProsthetic: dto.stancePercProsthetic,
      stancePercSound: dto.stancePercSound,
      symmetry: dto.symmetry as any,
      deviations: dto.deviations ?? {},
      mainProblem: dto.mainProblem,
      notes: dto.notes,
      examinerProsthetistId: dto.examinerProsthetistId,
      examinerPhysioId: dto.examinerPhysioId,
    };
    return this.prisma.gaitAnalysis.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
  }

  async signGaitAnalysis(caseId: string, dto: GaitSignDto, userId: string) {
    await this.findCaseOrThrow(caseId);
    const gait = await this.prisma.gaitAnalysis.findUnique({ where: { caseId } });
    if (!gait) throw new NotFoundException('Gait analysis not found');
    return this.prisma.gaitAnalysis.update({
      where: { caseId },
      data: {
        signedByDoctorId: userId,
        doctorSignatureBase64: dto.signatureBase64,
        doctorSignedAt: new Date(),
      },
    });
  }

  // ── Balance Assessment ────────────────────────────────────────────────────

  async createBalanceAssessment(caseId: string, dto: BalanceAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const data: any = {
      staticResults: dto.staticResults,
      dynamicResults: dto.dynamicResults,
      activityResults: dto.activityResults,
      historyOfFalls: dto.historyOfFalls ?? false,
      nearFalls: dto.nearFalls ?? false,
      fearOfFalling: dto.fearOfFalling ?? false,
      fallRiskLevel: dto.fallRiskLevel as any,
      overallBalanceLevel: dto.overallBalanceLevel as any,
      exerciseProgram: dto.exerciseProgram ?? {},
      homeExerciseProgram: dto.homeExerciseProgram ?? false,
      followUpWeeks: dto.followUpWeeks,
      examinerPhysioId: dto.examinerPhysioId,
      committeeHeadId: dto.committeeHeadId,
    };
    return this.prisma.balanceAssessment.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
  }

  // ── Treatment Plan ────────────────────────────────────────────────────────

  async createTreatmentPlan(caseId: string, dto: TreatmentPlanDto) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.treatmentPlan.upsert({
      where: { caseId },
      create: { caseId, notes: dto.notes },
      update: { notes: dto.notes },
    });
  }

  async addWorkshopSession(caseId: string, dto: WorkshopSessionDto) {
    await this.findCaseOrThrow(caseId);
    let plan = await this.prisma.treatmentPlan.findUnique({ where: { caseId } });
    if (!plan) plan = await this.prisma.treatmentPlan.create({ data: { caseId } });
    return this.prisma.workshopSession.create({
      data: {
        planId: plan.id,
        sessionDate: new Date(dto.sessionDate),
        sessionTime: dto.sessionTime,
        providedService: dto.providedService,
        notes: dto.notes,
        technicianId: dto.technicianId,
      },
    });
  }

  async addPtSession(caseId: string, dto: PtSessionDto) {
    await this.findCaseOrThrow(caseId);
    let plan = await this.prisma.treatmentPlan.findUnique({ where: { caseId } });
    if (!plan) plan = await this.prisma.treatmentPlan.create({ data: { caseId } });
    return this.prisma.ptSession.create({
      data: {
        planId: plan.id,
        sessionDate: new Date(dto.sessionDate),
        sessionTime: dto.sessionTime,
        providedService: dto.providedService,
        notes: dto.notes,
        physiotherapistId: dto.physiotherapistId,
      },
    });
  }

  async addMediaSession(caseId: string, dto: MediaSessionDto) {
    await this.findCaseOrThrow(caseId);
    let plan = await this.prisma.treatmentPlan.findUnique({ where: { caseId } });
    if (!plan) plan = await this.prisma.treatmentPlan.create({ data: { caseId } });
    return this.prisma.mediaSession.create({
      data: {
        planId: plan.id,
        sessionDate: new Date(dto.sessionDate),
        sessionTime: dto.sessionTime,
        providedService: dto.providedService,
        notes: dto.notes,
        supervisorId: dto.supervisorId,
      },
    });
  }

  // ── Balance Assessment & Exercise Program Form Pro-015 ──────────────────

  async addBalanceAssessmentForm(caseId: string, dto: BalanceAssessmentFormDto) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.balanceAssessmentForm.create({
      data: {
        caseId,
        assessmentDate:    dto.assessmentDate ? new Date(dto.assessmentDate) : undefined,
        previousProsthesis: dto.previousProsthesis,
        assistiveDevice:   dto.assistiveDevice,
        staticBalance:     dto.staticBalance ?? undefined,
        dynamicTasks:      dto.dynamicTasks ?? undefined,
        dynamicActivities: dto.dynamicActivities ?? undefined,
        historyOfFalls:    dto.historyOfFalls,
        nearFalls:         dto.nearFalls,
        fearOfFalling:     dto.fearOfFalling,
        fallRiskLevel:     dto.fallRiskLevel,
        overallBalanceLevel: dto.overallBalanceLevel,
        limitingFactors:   dto.limitingFactors ?? [],
        exerciseProgram:   dto.exerciseProgram ?? undefined,
        programProgression: dto.programProgression ?? [],
        followUpWeeks:     dto.followUpWeeks,
        expectedOutcomes:  dto.expectedOutcomes ?? [],
        physiotherapistId: dto.physiotherapistId,
        physiotherapistSignatureUrl: dto.physiotherapistSignatureUrl,
        committeeHeadId:   dto.committeeHeadId,
        committeeHeadSignatureUrl:   dto.committeeHeadSignatureUrl,
        followUpDate:      dto.followUpDate ? new Date(dto.followUpDate) : undefined,
        notes:             dto.notes,
      },
    });
  }

  async getBalanceAssessmentForms(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.balanceAssessmentForm.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateBalanceAssessmentForm(caseId: string, formId: string, dto: BalanceAssessmentFormDto) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.balanceAssessmentForm.findFirst({ where: { id: formId, caseId } });
    if (!form) throw new NotFoundException('Balance assessment form not found');
    return this.prisma.balanceAssessmentForm.update({
      where: { id: formId },
      data: {
        assessmentDate:    dto.assessmentDate ? new Date(dto.assessmentDate) : undefined,
        previousProsthesis: dto.previousProsthesis,
        assistiveDevice:   dto.assistiveDevice,
        staticBalance:     dto.staticBalance ?? undefined,
        dynamicTasks:      dto.dynamicTasks ?? undefined,
        dynamicActivities: dto.dynamicActivities ?? undefined,
        historyOfFalls:    dto.historyOfFalls,
        nearFalls:         dto.nearFalls,
        fearOfFalling:     dto.fearOfFalling,
        fallRiskLevel:     dto.fallRiskLevel,
        overallBalanceLevel: dto.overallBalanceLevel,
        limitingFactors:   dto.limitingFactors ?? [],
        exerciseProgram:   dto.exerciseProgram ?? undefined,
        programProgression: dto.programProgression ?? [],
        followUpWeeks:     dto.followUpWeeks,
        expectedOutcomes:  dto.expectedOutcomes ?? [],
        physiotherapistId: dto.physiotherapistId,
        physiotherapistSignatureUrl: dto.physiotherapistSignatureUrl,
        committeeHeadId:   dto.committeeHeadId,
        committeeHeadSignatureUrl:   dto.committeeHeadSignatureUrl,
        followUpDate:      dto.followUpDate ? new Date(dto.followUpDate) : undefined,
        notes:             dto.notes,
      },
    });
  }

  async deleteBalanceAssessmentForm(caseId: string, formId: string) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.balanceAssessmentForm.findFirst({ where: { id: formId, caseId } });
    if (!form) throw new NotFoundException('Balance assessment form not found');
    return this.prisma.balanceAssessmentForm.delete({ where: { id: formId } });
  }

  // ── Prosthetic Delivery Form Pro-019 ────────────────────────────────────

  async upsertDeliveryForm(caseId: string, dto: ProstheticDeliveryFormDto) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.prostheticDeliveryForm.upsert({
      where: { caseId },
      create: {
        caseId,
        inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : undefined,
        prosthetistId:     dto.prosthetistId,
        physiotherapistId: dto.physiotherapistId,
        ceoId:             dto.ceoId,
        ceoSignatureUrl:   dto.ceoSignatureUrl,
        signatureDate: dto.signatureDate ? new Date(dto.signatureDate) : undefined,
      },
      update: {
        inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : undefined,
        prosthetistId:     dto.prosthetistId,
        physiotherapistId: dto.physiotherapistId,
        ceoId:             dto.ceoId,
        ceoSignatureUrl:   dto.ceoSignatureUrl,
        signatureDate: dto.signatureDate ? new Date(dto.signatureDate) : undefined,
      },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getDeliveryForm(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.prostheticDeliveryForm.findUnique({
      where: { caseId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async addDeliveryItem(caseId: string, dto: ProstheticDeliveryItemDto) {
    await this.findCaseOrThrow(caseId);
    let form = await this.prisma.prostheticDeliveryForm.findUnique({ where: { caseId } });
    if (!form) form = await this.prisma.prostheticDeliveryForm.create({ data: { caseId } });
    return this.prisma.prostheticDeliveryItem.create({
      data: {
        formId:          form.id,
        deliveredProduct: dto.deliveredProduct,
        partCode:        dto.partCode,
        quantity:        dto.quantity,
        company:         dto.company,
        notes:           dto.notes,
      },
    });
  }

  async updateDeliveryItem(caseId: string, itemId: string, dto: ProstheticDeliveryItemDto) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.prostheticDeliveryForm.findUnique({ where: { caseId } });
    if (!form) throw new NotFoundException('Delivery form not found');
    const item = await this.prisma.prostheticDeliveryItem.findFirst({ where: { id: itemId, formId: form.id } });
    if (!item) throw new NotFoundException('Item not found');
    return this.prisma.prostheticDeliveryItem.update({
      where: { id: itemId },
      data: {
        deliveredProduct: dto.deliveredProduct,
        partCode:        dto.partCode,
        quantity:        dto.quantity,
        company:         dto.company,
        notes:           dto.notes,
      },
    });
  }

  async deleteDeliveryItem(caseId: string, itemId: string) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.prostheticDeliveryForm.findUnique({ where: { caseId } });
    if (!form) throw new NotFoundException('Delivery form not found');
    const item = await this.prisma.prostheticDeliveryItem.findFirst({ where: { id: itemId, formId: form.id } });
    if (!item) throw new NotFoundException('Item not found');
    return this.prisma.prostheticDeliveryItem.delete({ where: { id: itemId } });
  }

  // ── Patient Review Program (بعد اكتمال العلاج) ──────────────────────────

  async addReviewProgram(caseId: string, dto: PatientReviewProgramDto) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.patientReviewProgram.create({
      data: {
        caseId,
        sessionDate:      dto.sessionDate ? new Date(dto.sessionDate) : undefined,
        sessionTime:      dto.sessionTime,
        description:      dto.description,
        technicianId:     dto.technicianId,
        sessionStartTime: dto.sessionStartTime,
        sessionEndTime:   dto.sessionEndTime,
        signatureUrl:     dto.signatureUrl,
        notes:            dto.notes,
      },
    });
  }

  async getReviewPrograms(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.patientReviewProgram.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateReviewProgram(caseId: string, reviewId: string, dto: PatientReviewProgramDto) {
    await this.findCaseOrThrow(caseId);
    const review = await this.prisma.patientReviewProgram.findFirst({ where: { id: reviewId, caseId } });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.patientReviewProgram.update({
      where: { id: reviewId },
      data: {
        sessionDate:      dto.sessionDate ? new Date(dto.sessionDate) : undefined,
        sessionTime:      dto.sessionTime,
        description:      dto.description,
        technicianId:     dto.technicianId,
        sessionStartTime: dto.sessionStartTime,
        sessionEndTime:   dto.sessionEndTime,
        signatureUrl:     dto.signatureUrl,
        notes:            dto.notes,
      },
    });
  }

  async deleteReviewProgram(caseId: string, reviewId: string) {
    await this.findCaseOrThrow(caseId);
    const review = await this.prisma.patientReviewProgram.findFirst({ where: { id: reviewId, caseId } });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.patientReviewProgram.delete({ where: { id: reviewId } });
  }

  // ── Case Treatment Program Pro-004 (مرتبط بالحالة مباشرة) ──────────────

  async addCaseTreatmentProgram(caseId: string, dto: CaseTreatmentProgramDto) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.caseTreatmentProgram.create({
      data: {
        caseId,
        sessionDate:            dto.sessionDate ? new Date(dto.sessionDate) : undefined,
        sessionTime:            dto.sessionTime,
        sessionStartTime:       dto.sessionStartTime,
        sessionEndTime:         dto.sessionEndTime,
        description:            dto.description,
        technicianId:           dto.technicianId,
        technicianSignatureUrl: dto.technicianSignatureUrl,
        managerSignatureUrl:    dto.managerSignatureUrl,
        notes:                  dto.notes,
      },
    });
  }

  async getCaseTreatmentPrograms(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.caseTreatmentProgram.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateCaseTreatmentProgram(caseId: string, programId: string, dto: CaseTreatmentProgramDto) {
    await this.findCaseOrThrow(caseId);
    const program = await this.prisma.caseTreatmentProgram.findFirst({ where: { id: programId, caseId } });
    if (!program) throw new NotFoundException('Treatment program not found');
    return this.prisma.caseTreatmentProgram.update({
      where: { id: programId },
      data: {
        sessionDate:            dto.sessionDate ? new Date(dto.sessionDate) : undefined,
        sessionTime:            dto.sessionTime,
        sessionStartTime:       dto.sessionStartTime,
        sessionEndTime:         dto.sessionEndTime,
        description:            dto.description,
        technicianId:           dto.technicianId,
        technicianSignatureUrl: dto.technicianSignatureUrl,
        managerSignatureUrl:    dto.managerSignatureUrl,
        notes:                  dto.notes,
      },
    });
  }

  async deleteCaseTreatmentProgram(caseId: string, programId: string) {
    await this.findCaseOrThrow(caseId);
    const program = await this.prisma.caseTreatmentProgram.findFirst({ where: { id: programId, caseId } });
    if (!program) throw new NotFoundException('Treatment program not found');
    return this.prisma.caseTreatmentProgram.delete({ where: { id: programId } });
  }

  // ── Patient Treatment Program (Pro-004) ──────────────────────────────────

  async upsertTreatmentProgram(
    sessionType: 'workshop' | 'pt' | 'media',
    sessionId: string,
    dto: PatientTreatmentProgramDto,
  ) {
    if (sessionType === 'workshop') {
      const session = await this.prisma.workshopSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Workshop session not found');
      return this.prisma.patientTreatmentProgram.upsert({
        where: { workshopSessionId: sessionId },
        create: { workshopSessionId: sessionId, ...dto },
        update: { ...dto },
      });
    }
    if (sessionType === 'pt') {
      const session = await this.prisma.ptSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('PT session not found');
      return this.prisma.patientTreatmentProgram.upsert({
        where: { ptSessionId: sessionId },
        create: { ptSessionId: sessionId, ...dto },
        update: { ...dto },
      });
    }
    const session = await this.prisma.mediaSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Media session not found');
    return this.prisma.patientTreatmentProgram.upsert({
      where: { mediaSessionId: sessionId },
      create: { mediaSessionId: sessionId, ...dto },
      update: { ...dto },
    });
  }

  async getTreatmentProgram(sessionType: 'workshop' | 'pt' | 'media', sessionId: string) {
    if (sessionType === 'workshop') {
      return this.prisma.patientTreatmentProgram.findUnique({ where: { workshopSessionId: sessionId } });
    }
    if (sessionType === 'pt') {
      return this.prisma.patientTreatmentProgram.findUnique({ where: { ptSessionId: sessionId } });
    }
    return this.prisma.patientTreatmentProgram.findUnique({ where: { mediaSessionId: sessionId } });
  }

  // ── Consumables ───────────────────────────────────────────────────────────

  async addConsumable(caseId: string, dto: ConsumableDto, userId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.consumableUsage.create({
      data: {
        caseId,
        inventoryItemId: dto.inventoryItemId,
        consumableName: dto.consumableName,
        quantity: dto.quantity,
        unit: dto.unit,
        notes: dto.notes,
        usedBy: userId,
        supervisorId: dto.supervisorId,
      },
    });
  }

  // ── Final Evaluation ──────────────────────────────────────────────────────

  async createFinalEvaluation(caseId: string, dto: FinalEvaluationDto) {
    await this.findCaseOrThrow(caseId);
    const data: any = {
      residualLimbCondition: dto.residualLimbCondition,
      suspensionSystemUsed: dto.suspensionSystemUsed,
      socksDelivered: dto.socksDelivered,
      linersDelivered: dto.linersDelivered,
      fittingDate: dto.fittingDate ? new Date(dto.fittingDate) : undefined,
      generalNotes: dto.generalNotes,
      supervisorId: dto.supervisorId,
      physioOpinion:                dto.physioOpinion,
      departmentHeadOpinion:        dto.departmentHeadOpinion,
      prosthetistOpinion:           dto.prosthetistOpinion,
      prosthetistSupervisorOpinion: dto.prosthetistSupervisorOpinion,
      committeeHeadOpinion:         dto.committeeHeadOpinion,
      expertOpinion:                dto.expertOpinion,
      readyForDelivery:             dto.readyForDelivery ?? false,
      needsFollowUp:                dto.needsFollowUp ?? false,
      followUpPlan:                 dto.followUpPlan,
      medicalDirectorNotes:         dto.medicalDirectorNotes,
    };
    return this.prisma.finalEvaluation.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
  }

  async getFinalEvaluation(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.finalEvaluation.findUnique({ where: { caseId } });
  }

  async directorSign(caseId: string, dto: DirectorSignDto, userId: string, ip: string) {
    await this.findCaseOrThrow(caseId);
    const existing = await this.prisma.finalEvaluation.findUnique({ where: { caseId } });

    // B6.4: منع استبدال توقيع المدير الطبي القائم
    if (existing?.medicalDirectorSignatureBase64) {
      throw new ConflictException({ code: 'ALREADY_SIGNED', message: 'Medical director already signed' });
    }

    // B6.4: هذا التوقيع للمدير الطبي فقط — لا يُكتب على حقول المدير الإداري (manager*)
    const data: any = {
      medicalDirectorSignatureBase64: dto.signatureBase64,
      medicalDirectorSignedAt: new Date(),
      medicalDirectorIp: ip,
      medicalDirectorNotes: dto.medicalDirectorNotes,
      managerNotes: dto.managerNotes,
      patientFileComplete: dto.patientFileComplete,
    };
    if (!existing) {
      return this.prisma.finalEvaluation.create({
        data: { caseId, supervisorId: userId, ...data },
      });
    }
    return this.prisma.finalEvaluation.update({ where: { caseId }, data });
  }

  // ── Delivery ──────────────────────────────────────────────────────────────

  async createDelivery(caseId: string, dto: DeliveryDto) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.delivery.upsert({
      where: { caseId },
      create: {
        caseId,
        deliveryDate: new Date(dto.deliveryDate),
        prosthetistId: dto.prosthetistId,
        physiotherapistId: dto.physiotherapistId,
        deliveredItems: dto.deliveredItems,
        managerId: dto.managerId,
      },
      update: {
        deliveryDate: new Date(dto.deliveryDate),
        prosthetistId: dto.prosthetistId,
        physiotherapistId: dto.physiotherapistId,
        deliveredItems: dto.deliveredItems,
        managerId: dto.managerId,
      },
    });
  }

  async patientSign(caseId: string, dto: PatientSignDto) {
    await this.findCaseOrThrow(caseId);
    const delivery = await this.prisma.delivery.findUnique({ where: { caseId } });
    if (!delivery) throw new NotFoundException('Delivery record not found');
    return this.prisma.delivery.update({
      where: { caseId },
      data: { patientSignatureBase64: dto.signatureBase64, patientSignedAt: new Date() },
    });
  }

  async managerSign(caseId: string, dto: ManagerSignDto) {
    await this.findCaseOrThrow(caseId);
    const delivery = await this.prisma.delivery.findUnique({ where: { caseId } });
    if (!delivery) throw new NotFoundException('Delivery record not found');
    return this.prisma.delivery.update({
      where: { caseId },
      data: { managerSignatureBase64: dto.signatureBase64, managerSignedAt: new Date() },
    });
  }

  // ── Follow-ups ────────────────────────────────────────────────────────────

  async addFollowUp(caseId: string, dto: FollowUpDto, userId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.followUp.create({
      data: {
        caseId,
        visitDate: new Date(dto.visitDate),
        findings: dto.findings,
        actions: dto.actions,
        practitionerId: dto.practitionerId || userId,
      },
    });
  }

  async getFollowUps(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.followUp.findMany({
      where: { caseId },
      orderBy: { visitDate: 'desc' },
    });
  }

  // ── Timeline ──────────────────────────────────────────────────────────────

  async getTimeline(caseId: string) {
    const c = await this.prisma.prostheticsCase.findFirst({
      where: { id: caseId, deletedAt: null },
      include: {
        upperAssessment:  { select: { side: true, examinedAt: true } },
        lowerAssessment:  { select: { side: true, examinedAt: true } },
        committeeReview:  {
          select: {
            prosthetistReviewedAt:    true,
            physiotherapistReviewedAt: true,
            doctorReviewedAt:         true,
            committeeHeadReviewedAt:  true,
            expertReviewedAt:         true,
            decidedAt:                true,
            finalDecision:            true,
            doctorSignedAt:           true,
          },
        },
        components:       { select: { addedAt: true, partName: true }, orderBy: { addedAt: 'asc' } },
        gaitAnalysis:     { select: { examinedAt: true, doctorSignedAt: true } },
        balanceAssessment:{ select: { examinedAt: true } },
        treatmentPlan: {
          include: {
            workshopSessions: { select: { sessionDate: true, providedService: true }, orderBy: { sessionDate: 'asc' } },
            ptSessions:       { select: { sessionDate: true, providedService: true }, orderBy: { sessionDate: 'asc' } },
            mediaSessions:    { select: { sessionDate: true, providedService: true }, orderBy: { sessionDate: 'asc' } },
          },
        },
        consumables:      { select: { usedAt: true, consumableName: true }, orderBy: { usedAt: 'asc' } },
        finalEvaluation:  { select: { fittingDate: true, medicalDirectorSignedAt: true, managerSignedAt: true } },
        delivery:         { select: { deliveryDate: true, patientSignedAt: true, managerSignedAt: true } },
        followUps:        { select: { visitDate: true, findings: true }, orderBy: { visitDate: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Prosthetics case not found');

    const events: Array<{ date: Date; type: string; title: string; description?: string }> = [];
    const add = (date: Date | null | undefined, type: string, title: string, description?: string) => {
      if (date) events.push({ date, type, title, description });
    };

    add(c.createdAt, 'case_created', 'تم إنشاء الملف');
    for (const ua of c.upperAssessment) {
      add(ua.examinedAt, 'assessment_upper', `تقييم الطرف العلوي (${ua.side === 'LEFT' ? 'يسار' : 'يمين'})`);
    }
    for (const la of c.lowerAssessment) {
      add(la.examinedAt, 'assessment_lower', `تقييم الطرف السفلي (${la.side === 'LEFT' ? 'يسار' : 'يمين'})`);
    }

    if (c.committeeReview) {
      const cr = c.committeeReview;
      add(cr.prosthetistReviewedAt,     'committee_opinion', 'رأي الأرثوبيدي');
      add(cr.physiotherapistReviewedAt, 'committee_opinion', 'رأي المعالج الفيزيائي');
      add(cr.doctorReviewedAt,          'committee_opinion', 'رأي الطبيب');
      add(cr.committeeHeadReviewedAt,   'committee_opinion', 'رأي رئيس اللجنة');
      add(cr.expertReviewedAt,          'committee_opinion', 'رأي الخبير');
      add(cr.decidedAt,                 'committee_decision', `قرار اللجنة: ${cr.finalDecision ?? ''}`);
      add(cr.doctorSignedAt,            'committee_signed',  'توقيع الطبيب على قرار اللجنة');
    }

    for (const comp of c.components)
      add(comp.addedAt, 'component_added', `إضافة مكون: ${comp.partName}`);

    if (c.gaitAnalysis) {
      add(c.gaitAnalysis.examinedAt,   'gait_analysis', 'تحليل المشي');
      add(c.gaitAnalysis.doctorSignedAt,'gait_signed',  'توقيع الطبيب على تحليل المشي');
    }
    if (c.balanceAssessment) add(c.balanceAssessment.examinedAt, 'balance_assessment', 'تقييم التوازن');

    if (c.treatmentPlan) {
      for (const s of c.treatmentPlan.workshopSessions)
        add(s.sessionDate, 'workshop_session', `جلسة ورشة: ${s.providedService}`);
      for (const s of c.treatmentPlan.ptSessions)
        add(s.sessionDate, 'pt_session', `جلسة علاج طبيعي: ${s.providedService}`);
      for (const s of c.treatmentPlan.mediaSessions)
        add(s.sessionDate, 'media_session', `جلسة وسائط: ${s.providedService}`);
    }

    for (const cons of c.consumables)
      add(cons.usedAt, 'consumable_used', `مستهلكات: ${cons.consumableName}`);

    if (c.finalEvaluation) {
      add(c.finalEvaluation.fittingDate,              'fitting',         'موعد التركيب');
      add(c.finalEvaluation.medicalDirectorSignedAt,  'director_signed', 'توقيع المدير الطبي');
      add(c.finalEvaluation.managerSignedAt,          'manager_signed',  'توقيع المدير');
    }

    if (c.delivery) {
      add(c.delivery.deliveryDate,    'delivery',                'تسليم الطرف الاصطناعي');
      add(c.delivery.patientSignedAt, 'patient_signed',          'توقيع المريض على التسليم');
      add(c.delivery.managerSignedAt, 'delivery_manager_signed', 'توقيع المدير على التسليم');
    }

    for (const fu of c.followUps)
      add(fu.visitDate, 'follow_up', 'متابعة', fu.findings);

    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    return { caseId, caseNumber: c.caseNumber, timeline: events };
  }

  // ── Attachments (صور البتر وغيرها — واحدة أو أكثر) ──────────────────────────

  async addAttachment(caseId: string, file: Express.Multer.File, caption: string | undefined, userId: string) {
    if (!file) throw new BadRequestException('لم يتم رفع أي ملف');
    await this.findCaseOrThrow(caseId);

    return this.prisma.caseAttachment.create({
      data: {
        caseId,
        fileName: file.originalname,
        filePath: (file as any).path,
        fileSize: file.size,
        mimeType: file.mimetype,
        caption,
        uploadedBy: userId,
      },
    });
  }

  async getAttachments(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.caseAttachment.findMany({
      where: { caseId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getAttachmentForDownload(caseId: string, attachmentId: string) {
    const att = await this.prisma.caseAttachment.findFirst({ where: { id: attachmentId, caseId } });
    if (!att) throw new NotFoundException('المرفق غير موجود');
    return att;
  }

  async deleteAttachment(caseId: string, attachmentId: string) {
    const att = await this.prisma.caseAttachment.findFirst({ where: { id: attachmentId, caseId } });
    if (!att) throw new NotFoundException('المرفق غير موجود');
    await this.prisma.caseAttachment.delete({ where: { id: attachmentId } });
    return { message: 'تم حذف المرفق' };
  }

  // ── Gait Analysis Form Pro-016 (متعدد لكل حالة) ──────────────────────────

  async addGaitAnalysisForm(caseId: string, dto: GaitAnalysisFormDto) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.gaitAnalysisForm.create({
      data: {
        caseId,
        sessionDate:              dto.sessionDate ? new Date(dto.sessionDate) : undefined,
        suspensionSystem:         dto.suspensionSystem ?? [],
        socketBearing:            dto.socketBearing,
        kneeJointType:            dto.kneeJointType,
        footType:                 dto.footType,
        patientComplaints:        dto.patientComplaints ?? [],
        painIntensity:            dto.painIntensity,
        alignmentCheck:           dto.alignmentCheck,
        hasRomLimitations:        dto.hasRomLimitations,
        hasHipFlexionContracture: dto.hasHipFlexionContracture,
        hasKneeFlexionContracture: dto.hasKneeFlexionContracture,
        weakHipAbductors:         dto.weakHipAbductors,
        weakHipExtensors:         dto.weakHipExtensors,
        weakTrunkMuscles:         dto.weakTrunkMuscles,
        otherWeakness:            dto.otherWeakness,
        trunkStability:           dto.trunkStability,
        abdominalControl:         dto.abdominalControl,
        pelvicControl:            dto.pelvicControl,
        sittingBalance:           dto.sittingBalance,
        standingBalance:          dto.standingBalance,
        assistiveDevice:          dto.assistiveDevice,
        speedMs:                  dto.speedMs,
        cadence:                  dto.cadence,
        stepLengthProsCm:         dto.stepLengthProsCm,
        stepLengthSoundCm:        dto.stepLengthSoundCm,
        stancePercProsthetic:     dto.stancePercProsthetic,
        stancePercSound:          dto.stancePercSound,
        symmetry:                 dto.symmetry,
        initialContact:           dto.initialContact,
        loadingResponse:          dto.loadingResponse,
        midStance:                dto.midStance,
        terminalStance:           dto.terminalStance,
        preSwing:                 dto.preSwing,
        swingPhase:               dto.swingPhase,
        gaitNotes:                dto.gaitNotes,
        prostheticIssues:         dto.prostheticIssues ?? [],
        mainProblem:              dto.mainProblem,
        likelyCauses:             dto.likelyCauses ?? [],
        recommendations:          dto.recommendations ?? [],
        rehabPlan:                dto.rehabPlan,
        rehabNotes:               dto.rehabNotes,
        examinerProsthetistId:       dto.examinerProsthetistId,
        prosthetistSignatureUrl:     dto.prosthetistSignatureUrl,
        examinerPhysiotherapistId:   dto.examinerPhysiotherapistId,
        physiotherapistSignatureUrl: dto.physiotherapistSignatureUrl,
        notes:                    dto.notes,
      },
    });
  }

  async getGaitAnalysisForms(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.gaitAnalysisForm.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateGaitAnalysisForm(caseId: string, formId: string, dto: GaitAnalysisFormDto) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.gaitAnalysisForm.findFirst({ where: { id: formId, caseId } });
    if (!form) throw new NotFoundException('Gait analysis form not found');
    return this.prisma.gaitAnalysisForm.update({
      where: { id: formId },
      data: {
        sessionDate:              dto.sessionDate ? new Date(dto.sessionDate) : undefined,
        suspensionSystem:         dto.suspensionSystem,
        socketBearing:            dto.socketBearing,
        kneeJointType:            dto.kneeJointType,
        footType:                 dto.footType,
        patientComplaints:        dto.patientComplaints,
        painIntensity:            dto.painIntensity,
        alignmentCheck:           dto.alignmentCheck,
        hasRomLimitations:        dto.hasRomLimitations,
        hasHipFlexionContracture: dto.hasHipFlexionContracture,
        hasKneeFlexionContracture: dto.hasKneeFlexionContracture,
        weakHipAbductors:         dto.weakHipAbductors,
        weakHipExtensors:         dto.weakHipExtensors,
        weakTrunkMuscles:         dto.weakTrunkMuscles,
        otherWeakness:            dto.otherWeakness,
        trunkStability:           dto.trunkStability,
        abdominalControl:         dto.abdominalControl,
        pelvicControl:            dto.pelvicControl,
        sittingBalance:           dto.sittingBalance,
        standingBalance:          dto.standingBalance,
        assistiveDevice:          dto.assistiveDevice,
        speedMs:                  dto.speedMs,
        cadence:                  dto.cadence,
        stepLengthProsCm:         dto.stepLengthProsCm,
        stepLengthSoundCm:        dto.stepLengthSoundCm,
        stancePercProsthetic:     dto.stancePercProsthetic,
        stancePercSound:          dto.stancePercSound,
        symmetry:                 dto.symmetry,
        initialContact:           dto.initialContact,
        loadingResponse:          dto.loadingResponse,
        midStance:                dto.midStance,
        terminalStance:           dto.terminalStance,
        preSwing:                 dto.preSwing,
        swingPhase:               dto.swingPhase,
        gaitNotes:                dto.gaitNotes,
        prostheticIssues:         dto.prostheticIssues,
        mainProblem:              dto.mainProblem,
        likelyCauses:             dto.likelyCauses,
        recommendations:          dto.recommendations,
        rehabPlan:                dto.rehabPlan,
        rehabNotes:               dto.rehabNotes,
        examinerProsthetistId:       dto.examinerProsthetistId,
        prosthetistSignatureUrl:     dto.prosthetistSignatureUrl,
        examinerPhysiotherapistId:   dto.examinerPhysiotherapistId,
        physiotherapistSignatureUrl: dto.physiotherapistSignatureUrl,
        notes:                    dto.notes,
      },
    });
  }

  async deleteGaitAnalysisForm(caseId: string, formId: string) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.gaitAnalysisForm.findFirst({ where: { id: formId, caseId } });
    if (!form) throw new NotFoundException('Gait analysis form not found');
    return this.prisma.gaitAnalysisForm.delete({ where: { id: formId } });
  }
}
