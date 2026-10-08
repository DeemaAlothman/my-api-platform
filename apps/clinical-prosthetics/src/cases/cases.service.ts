import {
  Injectable, NotFoundException, BadRequestException,
  InternalServerErrorException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto, UpdateCaseDto, UpdateStatusDto, ListCasesQueryDto, TimelineQueryDto } from './dto/case.dto';
import { UpperLimbAssessmentDto, LowerLimbAssessmentDto, AnkleDisarticulationAssessmentDto, KneeDisarticulationAssessmentDto, TransfemoralAssessmentDto, TranstibialAssessmentDto, HemipelvectomyAssessmentDto, TransradialAssessmentDto, ElbowDisarticulationAssessmentDto, TranshumeralAssessmentDto } from './dto/assessment.dto';
import { CommitteeOpinionDto, CommitteeDecideDto, CommitteeSignDto } from './dto/committee.dto';
import {
  AddComponentDto, GaitAnalysisDto, BalanceAssessmentDto,
  TreatmentPlanDto, WorkshopSessionDto, PtSessionDto, MediaSessionDto, ConsumableDto,
  PatientTreatmentProgramDto, PatientReviewProgramDto,
  ProstheticDeliveryFormDto, ProstheticDeliveryItemDto,
  FinalDeliveryFormDto,
  BalanceAssessmentFormDto, GaitAnalysisFormDto,
  CaseTreatmentProgramDto,
} from './dto/treatment.dto';
import {
  FinalEvaluationDto, DirectorSignDto, DeliveryDto,
  PatientSignDto, ManagerSignDto, FollowUpDto, GaitSignDto,
} from './dto/delivery.dto';

const PATIENTS_URL = process.env.PATIENTS_SERVICE_URL || 'http://patients:4010';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
// مسار خدمة المستودع الجديدة — يعمل بالتوازي مع النظام القديم فقط، ولا يستبدله (انظر addComponent)
const WAREHOUSE_URL = process.env.WAREHOUSE_SERVICE_URL || 'http://warehouse:4018';
const WAREHOUSE_ENABLED = process.env.WAREHOUSE_ENABLED === 'true';

// حقول قسم "العضلات وحركة المفاصل" — أي حقل غير هدول يُحسب على أنه قسم "الطرف"
const UPPER_MUSCLE_KEYS = ['romData', 'canBalanceOneSide'];
const LOWER_MUSCLE_KEYS = [
  'romData', 'muscleMotionNotes',
  'usesAssistiveDevices', 'assistiveDeviceTypes', 'canClimbStairs', 'canBalanceOneSide',
];

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

  private async resolveUserNames(
    userIds: Array<string | null | undefined>,
  ): Promise<Record<string, { firstNameAr: string; lastNameAr: string }>> {
    const ids = [...new Set(userIds.filter(Boolean) as string[])];
    if (ids.length === 0) return {};
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      userId: string; firstNameAr: string; lastNameAr: string;
    }>>(
      `SELECT u.id as "userId", e."firstNameAr", e."lastNameAr"
       FROM users.users u
       JOIN users.employees e ON e."userId" = u.id
       WHERE u.id = ANY($1::text[]) AND e."deletedAt" IS NULL`,
      ids,
    ).catch(() => []);
    const map: Record<string, { firstNameAr: string; lastNameAr: string }> = {};
    for (const r of rows) map[r.userId] = { firstNameAr: r.firstNameAr, lastNameAr: r.lastNameAr };
    return map;
  }

  private readonly STATUS_ORDER = [
    'INTAKE', 'ASSESSMENT', 'COMMITTEE_REVIEW', 'FITTING', 'SOCKET_TRIAL',
    'FOLLOW_UP', 'FINAL_REVIEW', 'DELIVERED',
  ];

  // المعاينة العامة (علوي/سفلي) أو اللجنة → تمت المعاينة. ورقة القياس (نماذج مستوى البتر) → اخذ قياس.
  private async autoAdvanceStatus(caseId: string, targetStatus: string): Promise<void> {
    try {
      const c = await this.prisma.prostheticsCase.findFirst({
        where: { id: caseId, deletedAt: null },
        select: { status: true },
      });
      if (!c || c.status === 'CANCELLED') return;
      const currentIdx = this.STATUS_ORDER.indexOf(c.status as string);
      const targetIdx  = this.STATUS_ORDER.indexOf(targetStatus);
      if (targetIdx <= currentIdx) return;
      await this.prisma.prostheticsCase.update({
        where: { id: caseId },
        data: { status: targetStatus as any },
      });
      await this.recordStageChange(caseId, c.status as string, targetStatus, 'AUTO');
    } catch { /* لا يوقف العملية الأصلية */ }
  }

  // تسجيل دخول مرحلة بتاريخ المراحل — فشله لا يوقف العملية الأصلية
  private async recordStageChange(
    caseId: string, fromStatus: string | null, toStatus: string,
    source: 'CREATE' | 'MANUAL' | 'AUTO', changedBy?: string | null, reason?: string | null,
  ): Promise<void> {
    if (fromStatus === toStatus) return;
    await this.prisma.caseStageHistory.create({
      data: { caseId, fromStatus, toStatus, source, changedBy: changedBy ?? null, reason: reason ?? null },
    }).catch(() => {});
  }

  private async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PR-${year}-`;
    const last = await this.prisma.prostheticsCase.findFirst({
      where: { caseNumber: { startsWith: prefix } },
      orderBy: { caseNumber: 'desc' },
      select: { caseNumber: true },
    });
    let num = 1;
    if (last) {
      const lastNum = parseInt(last.caseNumber.replace(prefix, ''), 10);
      if (!isNaN(lastNum)) num = lastNum + 1;
    }
    return `${prefix}${String(num).padStart(4, '0')}`;
  }

  private async findCaseOrThrow(id: string) {
    const c = await this.prisma.prostheticsCase.findFirst({ where: { id, deletedAt: null } });
    if (!c) throw new NotFoundException('Prosthetics case not found');
    return c;
  }

  private readonly INVENTORY_MANAGER_IDS = [
    '415be69c-749b-41f5-a800-43b63baa794c',
    'f2297d60-1c06-44d7-b68d-cc5980affd37',
    '0aa5dc3e-d1e1-4b11-ac92-b4a6648556cc',
  ];

  private async notifyInventoryManagers(partCode: string, partName: string, caseId: string, requestId: string | null) {
    const msgAr = `طلب قطعة جديد: ${partName} (${partCode})`;
    const data = JSON.stringify({ requestId, caseId, partCode, partName });
    for (const managerId of this.INVENTORY_MANAGER_IDS) {
      try {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications
             (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "data", "createdAt")
           VALUES
             (gen_random_uuid(), $1, 'INVENTORY_REQUEST',
              'طلب قطعة — أطراف صناعية', 'Part Request — Prosthetics', $2, $3, false, $4::jsonb, NOW())`,
          managerId, msgAr, msgAr, data,
        );
      } catch (_) {}
    }
  }

  // ── Cases CRUD ────────────────────────────────────────────────────────────

  async create(dto: CreateCaseDto, userId: string) {
    const caseNumber = await this.generateCaseNumber();
    const created = await this.prisma.prostheticsCase.create({
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
        clinicalHistory: dto.clinicalHistory,
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
    await this.recordStageChange(created.id, null, created.status as string, 'CREATE', userId);
    return created;
  }

  async findAll(query: ListCasesQueryDto) {
    const { page = 1, limit = 20, patientId, status, amputationType, prosthetistId, deliveredFrom, deliveredTo } = query;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (amputationType) where.amputationType = { has: amputationType };
    if (prosthetistId) where.prosthetistId = prosthetistId;
    if (deliveredFrom || deliveredTo) {
      const inspectionDate: any = {};
      if (deliveredFrom) inspectionDate.gte = new Date(deliveredFrom);
      // شامل ليوم "إلى" كامل
      if (deliveredTo) inspectionDate.lt = new Date(new Date(deliveredTo).getTime() + 86_400_000);
      where.finalDelivery = { is: { inspectionDate } };
    }

    const [items, total] = await Promise.all([
      this.prisma.prostheticsCase.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          upperAssessment: { select: { id: true, side: true, examinedAt: true } },
          lowerAssessment: { select: { id: true, side: true, examinedAt: true } },
          committeeReview: { select: { id: true, finalDecision: true } },
          finalDelivery: { select: { inspectionDate: true } },
        },
      }),
      this.prisma.prostheticsCase.count({ where }),
    ]);
    const nameMap = await this.resolvePatientNames(items.map((i) => i.patientId));
    const enriched = items.map(({ finalDelivery, ...i }) => ({
      ...i,
      patient: nameMap[i.patientId] ?? null,
      finalDeliveryDate: finalDelivery?.inspectionDate ? finalDelivery.inspectionDate.toISOString().slice(0, 10) : null,
    }));
    return { items: enriched, total, page, limit };
  }

  private async resolveEmployeeIdByUserId(userId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      userId,
    ).catch(() => []);
    return rows[0]?.id ?? null;
  }

  async findOne(id: string, currentUserId?: string) {
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

    const cr = c.committeeReview as any;
    const userMap = await this.resolveUserNames([
      cr?.prosthetistUserId, cr?.physiotherapistUserId, cr?.doctorUserId,
      cr?.committeeHeadUserId, cr?.expertUserId,
    ]);

    // تحديد دور المستخدم الحالي في اللجنة
    let myCommitteeRole: string | null = null;
    if (currentUserId) {
      const myEmployeeId = await this.resolveEmployeeIdByUserId(currentUserId);
      if (myEmployeeId) {
        if (myEmployeeId === c.prosthetistId)       myCommitteeRole = 'PROSTHETIST';
        else if (myEmployeeId === c.physiotherapistId) myCommitteeRole = 'PHYSIOTHERAPIST';
        else if (myEmployeeId === c.supervisingDoctorId) myCommitteeRole = 'DOCTOR';
      }
      // COMMITTEE_HEAD / EXPERT: يُعرف عبر التعيين المسبق أو عبر userId بعد التقديم
      if (!myCommitteeRole && cr) {
        if (cr.assignedCommitteeHeadUserId === currentUserId || cr.committeeHeadUserId === currentUserId)
          myCommitteeRole = 'COMMITTEE_HEAD';
        else if (cr.assignedExpertUserId === currentUserId || cr.expertUserId === currentUserId)
          myCommitteeRole = 'EXPERT';
      }
    }

    // فريق عمل متعدد الأعضاء: الحالات القديمة لم تُحفظ فيها المصفوفة بعد — نشتقها من الحقل المفرد عند الحاجة
    const prosthetistIds       = c.prosthetistIds.length       ? c.prosthetistIds       : (c.prosthetistId       ? [c.prosthetistId]       : []);
    const physiotherapistIds   = c.physiotherapistIds.length   ? c.physiotherapistIds   : (c.physiotherapistId   ? [c.physiotherapistId]   : []);
    const supervisingDoctorIds = c.supervisingDoctorIds.length ? c.supervisingDoctorIds : (c.supervisingDoctorId ? [c.supervisingDoctorId] : []);

    return {
      ...c,
      prosthetistIds, physiotherapistIds, supervisingDoctorIds,
      patient: nameMap[c.patientId] ?? null,
      prosthetist: c.prosthetistId ? (empMap[c.prosthetistId] ?? null) : null,
      physiotherapist: c.physiotherapistId ? (empMap[c.physiotherapistId] ?? null) : null,
      supervisingDoctor: c.supervisingDoctorId ? (empMap[c.supervisingDoctorId] ?? null) : null,
      workshopSupervisor: c.workshopSupervisorId ? (empMap[c.workshopSupervisorId] ?? null) : null,
      myCommitteeRole,
      committeeReview: cr ? {
        ...cr,
        prosthetistUser:      cr.prosthetistUserId      ? (userMap[cr.prosthetistUserId]      ?? null) : null,
        physiotherapistUser:  cr.physiotherapistUserId  ? (userMap[cr.physiotherapistUserId]  ?? null) : null,
        doctorUser:           cr.doctorUserId           ? (userMap[cr.doctorUserId]           ?? null) : null,
        committeeHeadUser:    cr.committeeHeadUserId    ? (userMap[cr.committeeHeadUserId]    ?? null) : null,
        expertUser:           cr.expertUserId           ? (userMap[cr.expertUserId]           ?? null) : null,
      } : null,
    };
  }

  async update(id: string, dto: UpdateCaseDto) {
    await this.findCaseOrThrow(id);
    await this.autoAdvanceStatus(id, 'ASSESSMENT');

    // فريق عمل متعدد الأعضاء: المصفوفة (إذا أُرسلت) هي مصدر الحقيقة وتُملي الحقل المفرد بأول عنصر.
    // العملاء القدامى يرسلون الحقل المفرد فقط — نُبقي المصفوفة متزامنة معه.
    const teamData: any = {};
    if (dto.prosthetistIds !== undefined) {
      teamData.prosthetistIds = dto.prosthetistIds;
      teamData.prosthetistId = dto.prosthetistIds[0] ?? null;
    } else if (dto.prosthetistId !== undefined) {
      teamData.prosthetistId = dto.prosthetistId;
      teamData.prosthetistIds = dto.prosthetistId ? [dto.prosthetistId] : [];
    }
    if (dto.physiotherapistIds !== undefined) {
      teamData.physiotherapistIds = dto.physiotherapistIds;
      teamData.physiotherapistId = dto.physiotherapistIds[0] ?? null;
    } else if (dto.physiotherapistId !== undefined) {
      teamData.physiotherapistId = dto.physiotherapistId;
      teamData.physiotherapistIds = dto.physiotherapistId ? [dto.physiotherapistId] : [];
    }
    if (dto.supervisingDoctorIds !== undefined) {
      teamData.supervisingDoctorIds = dto.supervisingDoctorIds;
      teamData.supervisingDoctorId = dto.supervisingDoctorIds[0] ?? null;
    } else if (dto.supervisingDoctorId !== undefined) {
      teamData.supervisingDoctorId = dto.supervisingDoctorId;
      teamData.supervisingDoctorIds = dto.supervisingDoctorId ? [dto.supervisingDoctorId] : [];
    }

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
        clinicalHistory: dto.clinicalHistory,
        currentlyUsingProsthesis: dto.currentlyUsingProsthesis,
        previouslyUsedProsthesis: dto.previouslyUsedProsthesis,
        previousProsthesisSystemDetail: dto.previousProsthesisSystemDetail,
        ...teamData,
        workshopSupervisorId: dto.workshopSupervisorId,
        prosthesisType: dto.prosthesisType as any,
        prosthesisSuitable: dto.prosthesisSuitable,
        proposedProsthesisType: dto.proposedProsthesisType,
        prosthesisCompleted: dto.prosthesisCompleted,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto, userId?: string) {
    const before = await this.findCaseOrThrow(id);
    const updated = await this.prisma.prostheticsCase.update({
      where: { id },
      data: { status: dto.status as any },
    });
    await this.recordStageChange(id, before.status as string, dto.status, 'MANUAL', userId, dto.reason ?? dto.note);
    return updated;
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

  async findByPractitioner(practitionerId: string) {
    const items = await this.prisma.prostheticsCase.findMany({
      where: {
        deletedAt: null,
        OR: [
          { prosthetistId: practitionerId },
          { physiotherapistId: practitionerId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        committeeReview: { select: { finalDecision: true } },
        delivery: { select: { deliveryDate: true } },
      },
    });
    const nameMap = await this.resolvePatientNames(items.map((i) => i.patientId));
    return items.map((i) => ({
      ...i,
      patient: i.patientId ? (nameMap[i.patientId] ?? null) : null,
    }));
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
    await this.autoAdvanceStatus(caseId, 'COMMITTEE_REVIEW'); // تمت المعاينة
    const side = dto.side as any;
    return this.prisma.upperLimbAssessment.create({
      data: {
        caseId,
        side,
        residualLimbLength: dto.residualLimbLength as any,
        residualLimbShape: dto.residualLimbShape as any,
        residualLimbPhotoUrl: dto.residualLimbPhotoUrl,
        amputationLevelNote: dto.amputationLevelNote,
        closureNotes: dto.closureNotes,
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
        generalHealthNotes: dto.generalHealthNotes,
        otherLimbCondition: dto.otherLimbCondition,
        hasOtherAffectedLimbs: dto.hasOtherAffectedLimbs,
        canBalanceOneSide: dto.canBalanceOneSide,
        usesCompressionBandage: dto.usesCompressionBandage,
        neuromaPresent: dto.neuromaPresent,
        usesProstheticLimb: dto.usesProstheticLimb,
        prostheticLimbType: dto.prostheticLimbType,
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
    await this.autoAdvanceStatus(caseId, 'COMMITTEE_REVIEW'); // تمت المعاينة
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
      phantomSensationPresent: dto.phantomSensationPresent,
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
      generalHealthNotes: dto.generalHealthNotes,
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
      usesProstheticLimb: dto.usesProstheticLimb,
      prostheticLimbType: dto.prostheticLimbType,
    };
    return this.prisma.lowerLimbAssessment.create({
      data: { caseId, side, ...data },
    });
  }

  async patchUpperAssessment(caseId: string, side: string, dto: Omit<UpperLimbAssessmentDto, 'side'>) {
    await this.findCaseOrThrow(caseId);
    const existing = await this.prisma.upperLimbAssessment.findFirst({
      where: { caseId, side: side as any },
      orderBy: { examinedAt: 'desc' },
      select: { id: true },
    });
    const data: any = {
      residualLimbLength:      dto.residualLimbLength,
      residualLimbShape:       dto.residualLimbShape,
      residualLimbPhotoUrl:    dto.residualLimbPhotoUrl,
      amputationLevelNote:     dto.amputationLevelNote,
      closureNotes:            dto.closureNotes,
      painPresent:             dto.painPresent,
      painArea:                dto.painArea,
      painIntensity:           dto.painIntensity,
      painTypes:               dto.painTypes as any,
      painTypeOtherDetail:     dto.painTypeOtherDetail,
      phantomPainPresent:      dto.phantomPainPresent,
      phantomPainIntensity:    dto.phantomPainIntensity,
      residualLimbPalpable:    dto.residualLimbPalpable,
      neuromaPalpable:         dto.neuromaPalpable,
      skinAppearance:          dto.skinAppearance as any,
      skinNotes:               dto.skinNotes,
      skinColor:               dto.skinColor as any,
      skinTemperature:         dto.skinTemperature as any,
      scarCondition:           dto.scarCondition as any,
      hasSkinGrafts:           dto.hasSkinGrafts,
      graftArea:               dto.graftArea,
      generalHealthNotes:      dto.generalHealthNotes,
      otherLimbCondition:      dto.otherLimbCondition,
      hasOtherAffectedLimbs:   dto.hasOtherAffectedLimbs,
      canBalanceOneSide:       dto.canBalanceOneSide,
      usesCompressionBandage:  dto.usesCompressionBandage,
      neuromaPresent:          dto.neuromaPresent,
      usesProstheticLimb:      dto.usesProstheticLimb,
      prostheticLimbType:      dto.prostheticLimbType,
      jointsRangeOfMotion:     dto.jointsRangeOfMotion as any,
      activityLevel:           dto.activityLevel as any,
      romData:                 dto.romData,
      muscleMotionNotes:       dto.muscleMotionNotes,
      examinerProsthetistIds:  dto.examinerProsthetistIds,
      examinerPhysioIds:       dto.examinerPhysioIds,
      examinerSupervisorIds:   dto.examinerSupervisorIds,
    };
    // حذف الحقول undefined حتى لا تكتب null فوق قيم موجودة
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    // طابع زمني لكل قسم بشكل مستقل
    const hasLimbFields = Object.keys(data).some(k => !UPPER_MUSCLE_KEYS.includes(k));
    const hasRomFields  = UPPER_MUSCLE_KEYS.some(k => (dto as any)[k] !== undefined);
    if (hasLimbFields) data.limbSavedAt = new Date();
    if (hasRomFields)  data.romSavedAt  = new Date();

    if (existing) {
      return this.prisma.upperLimbAssessment.update({ where: { id: existing.id }, data });
    }
    await this.autoAdvanceStatus(caseId, 'COMMITTEE_REVIEW'); // تمت المعاينة
    return this.prisma.upperLimbAssessment.create({ data: { caseId, side: side as any, ...data } });
  }

  async patchLowerAssessment(caseId: string, side: string, dto: Omit<LowerLimbAssessmentDto, 'side'>) {
    await this.findCaseOrThrow(caseId);
    const existing = await this.prisma.lowerLimbAssessment.findFirst({
      where: { caseId, side: side as any },
      orderBy: { examinedAt: 'desc' },
      select: { id: true },
    });
    const data: any = {
      residualLimbLength:       dto.residualLimbLength,
      residualLimbShape:        dto.residualLimbShape,
      residualLimbPhotoUrl:     dto.residualLimbPhotoUrl,
      amputationLevelNote:      dto.amputationLevelNote,
      painPresent:              dto.painPresent,
      painArea:                 dto.painArea,
      painIntensity:            dto.painIntensity,
      painTypes:                dto.painTypes as any,
      painTypeOtherDetail:      dto.painTypeOtherDetail,
      phantomSensationPresent:  dto.phantomSensationPresent,
      phantomPainPresent:       dto.phantomPainPresent,
      phantomPainIntensity:     dto.phantomPainIntensity,
      neuromaPalpable:          dto.neuromaPalpable,
      loadTolerance:            dto.loadTolerance as any,
      weightBearingLevel:       dto.weightBearingLevel as any,
      notes:                    dto.notes,
      skinAppearance:           dto.skinAppearance as any,
      skinColor:                dto.skinColor as any,
      skinTemperature:          dto.skinTemperature as any,
      scarCondition:            dto.scarCondition as any,
      hasSkinGrafts:            dto.hasSkinGrafts,
      graftArea:                dto.graftArea,
      otherLimbCondition:       dto.otherLimbCondition,
      generalHealthNotes:       dto.generalHealthNotes,
      usesAssistiveDevices:     dto.usesAssistiveDevices,
      assistiveDeviceTypes:     dto.assistiveDeviceTypes,
      canClimbStairs:           dto.canClimbStairs,
      canBalanceOneSide:        dto.canBalanceOneSide,
      jointsRangeOfMotion:      dto.jointsRangeOfMotion as any,
      activityLevel:            dto.activityLevel as any,
      romData:                  dto.romData,
      muscleMotionNotes:        dto.muscleMotionNotes,
      usesProstheticLimb:       dto.usesProstheticLimb,
      prostheticLimbType:       dto.prostheticLimbType,
      examinerProsthetistIds:   dto.examinerProsthetistIds,
      examinerPhysioIds:        dto.examinerPhysioIds,
      examinerSupervisorIds:    dto.examinerSupervisorIds,
    };
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const hasLimbFields = Object.keys(data).some(k => !LOWER_MUSCLE_KEYS.includes(k));
    const hasRomFields  = LOWER_MUSCLE_KEYS.some(k => (dto as any)[k] !== undefined);
    if (hasLimbFields) data.limbSavedAt = new Date();
    if (hasRomFields)  data.romSavedAt  = new Date();

    if (existing) {
      return this.prisma.lowerLimbAssessment.update({ where: { id: existing.id }, data });
    }
    await this.autoAdvanceStatus(caseId, 'COMMITTEE_REVIEW'); // تمت المعاينة
    return this.prisma.lowerLimbAssessment.create({ data: { caseId, side: side as any, ...data } });
  }

  async upsertTranshumeralAssessment(caseId: string, dto: TranshumeralAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    await this.autoAdvanceStatus(caseId, 'FITTING'); // ورقة قياس → اخذ قياس
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
    await this.autoAdvanceStatus(caseId, 'FITTING'); // ورقة قياس → اخذ قياس
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
    await this.autoAdvanceStatus(caseId, 'FITTING'); // ورقة قياس → اخذ قياس
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
    await this.autoAdvanceStatus(caseId, 'FITTING'); // ورقة قياس → اخذ قياس
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
    await this.autoAdvanceStatus(caseId, 'FITTING'); // ورقة قياس → اخذ قياس
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
    await this.autoAdvanceStatus(caseId, 'FITTING'); // ورقة قياس → اخذ قياس
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
    await this.autoAdvanceStatus(caseId, 'FITTING'); // ورقة قياس → اخذ قياس
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
    await this.autoAdvanceStatus(caseId, 'FITTING'); // ورقة قياس → اخذ قياس
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
    await this.autoAdvanceStatus(caseId, 'COMMITTEE_REVIEW'); // تمت المعاينة

    // قفل الرأي: لا يمكن تعديله بعد تقديمه
    const opinionFieldByRole: Record<string, string> = {
      PROSTHETIST:     'prosthetistOpinion',
      PHYSIOTHERAPIST: 'physiotherapistOpinion',
      DOCTOR:          'doctorOpinion',
      COMMITTEE_HEAD:  'committeeHeadOpinion',
      EXPERT:          'expertOpinion',
    };
    const opinionField = opinionFieldByRole[dto.role];
    if (opinionField) {
      const existing = await this.prisma.committeeReview.findUnique({ where: { caseId } });
      if (existing && (existing as any)[opinionField]) {
        throw new ConflictException('لا يمكن تعديل الرأي بعد تقديمه');
      }
    }

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

  async assignCommitteeMembers(caseId: string, data: { committeeHeadUserId?: string; expertUserId?: string }) {
    await this.findCaseOrThrow(caseId);
    const update: any = {};
    if (data.committeeHeadUserId !== undefined) update.assignedCommitteeHeadUserId = data.committeeHeadUserId;
    if (data.expertUserId        !== undefined) update.assignedExpertUserId        = data.expertUserId;
    return this.prisma.committeeReview.upsert({
      where:  { caseId },
      create: { caseId, ...update },
      update,
    });
  }

  async committeeDecide(caseId: string, dto: CommitteeDecideDto, userId: string) {
    await this.findCaseOrThrow(caseId);
    await this.autoAdvanceStatus(caseId, 'COMMITTEE_REVIEW'); // تمت المعاينة
    return this.prisma.committeeReview.upsert({
      where: { caseId },
      create: {
        caseId,
        finalDecision: dto.decision as any,
        finalSummary: dto.finalSummary,
        decidedAt: new Date(),
        decidedByUserId: userId,
      },
      update: {
        finalDecision: dto.decision as any,
        finalSummary: dto.finalSummary,
        decidedAt: new Date(),
        decidedByUserId: userId,
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
    await this.autoAdvanceStatus(caseId, 'ASSESSMENT');

    // إذا ما انبعت inventoryItemId، نبحث تلقائياً بالكود. إذا ما لقينا تطابق، نحفظ بدون خصم من المخزون
    let inventoryItemId = dto.inventoryItemId ?? null;
    let matchedInInventory = true;
    if (!inventoryItemId) {
      inventoryItemId = await this.findInventoryItemIdByCode(dto.partCode);
      matchedInInventory = !!inventoryItemId;
    }

    let inventoryRequest: { requestId: string; status: string; notes: string | null } | null = null;

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
    try {
      // نبحث عن الصنف الحقيقي إن وجد، ونجهّز بيانات الطلب
      let realItemId: string | null = null;
      let reqPartCode = dto.partCode;
      let reqName = dto.partName;
      let reqUnit = 'قطعة';

      if (inventoryItemId) {
        const rows = await this.prisma.$queryRawUnsafe<Array<{
          partCode: string; name: string; unit: string;
          status: string | null; linkedInventoryItemId: string | null;
        }>>(
          `SELECT "partCode", name, unit, status, "linkedInventoryItemId"
           FROM clinic_inventory.inventory_items WHERE id = $1 LIMIT 1`,
          inventoryItemId,
        );
        if (rows[0]) {
          realItemId = rows[0].status !== null && rows[0].linkedInventoryItemId
            ? rows[0].linkedInventoryItemId
            : inventoryItemId;

          const realRows = realItemId !== inventoryItemId
            ? await this.prisma.$queryRawUnsafe<Array<{ partCode: string; name: string; unit: string }>>(
                `SELECT "partCode", name, unit FROM clinic_inventory.inventory_items WHERE id = $1 LIMIT 1`,
                realItemId,
              )
            : rows;

          const item = realRows[0] ?? rows[0];
          reqPartCode = item.partCode;
          reqName = item.name;
          reqUnit = item.unit;
        }
      }

      // دائماً أنشئ طلب PENDING — حتى لو القطعة مو موجودة بالمخزون (linkedInventoryItemId = null)
      const requestRows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO clinic_inventory.inventory_items
           (id, "partCode", name, unit, status, "requestedByUserId", "linkedInventoryItemId",
            "isActive", "currentStock", "createdAt", "updatedAt")
         VALUES
           (gen_random_uuid(), $1, $2, $3, 'PENDING', $4, $5, true, 0, NOW(), NOW())
         RETURNING id`,
        reqPartCode, reqName, reqUnit, userId, realItemId,
      );

      if (requestRows[0]?.id) {
        await this.prisma.prosthesisComponent.update({
          where: { id: component.id },
          data: { inventoryItemId: requestRows[0].id },
        });
        (component as any).inventoryItemId = requestRows[0].id;
        inventoryRequest = { requestId: requestRows[0].id, status: 'PENDING', notes: null };
      }
    } catch (_) {}

    await this.notifyInventoryManagers(dto.partCode, dto.partName, caseId, inventoryRequest?.requestId ?? null);

    // ── مسار تجريبي موازٍ لخدمة warehouse الجديدة ──────────────────────────
    // خلف مفتاح إيقاف افتراضي (WAREHOUSE_ENABLED=false) — لا يُستبدل أي شيء أعلاه؛
    // هذا نداء إضافي بحت داخل try/catch منفصل، فشله لا يكسر إنشاء المكوّن ولا يغيّر
    // الرد المُرجَع (matchedInInventory/inventoryRequest أعلاه يبقيان كما هما تماماً).
    if (WAREHOUSE_ENABLED) {
      try {
        const res = await fetch(`${WAREHOUSE_URL}/api/v1/warehouse/material-requests/internal/from-part-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
          body: JSON.stringify({
            partCode: dto.partCode,
            quantity: 1,
            referenceType: 'PROSTHETICS_CASE',
            referenceId: caseId,
            requestedByUserId: userId,
          }),
        });
        const json: any = await res.json().catch(() => null);
        if (json?.data?.matched) {
          await this.prisma.prosthesisComponent.update({
            where: { id: component.id },
            data: { warehouseItemId: json.data.itemId, materialRequestId: json.data.materialRequestId },
          });
        }
      } catch { /* تجريبي وموازٍ فقط — لا يجوز أن يكسر تدفق إضافة المكوّن الحالي */ }
    }

    return { ...component, matchedInInventory, inventoryRequest };
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

    // كل مكون يشير مباشرة لطلبه (status IS NOT NULL) أو للصنف الحقيقي (status IS NULL)
    const items = await this.prisma.$queryRawUnsafe<Array<{
      id: string; status: string | null; notes: string | null;
    }>>(
      `SELECT id, status::text AS status, notes
       FROM clinic_inventory.inventory_items
       WHERE id = ANY($1::text[])`,
      itemIds,
    ).catch(() => [] as any[]);

    const itemMap = new Map<string, { status: string | null; notes: string | null }>();
    for (const i of items) itemMap.set(i.id, i);

    return components.map((c: any) => {
      const inv = c.inventoryItemId ? itemMap.get(c.inventoryItemId) : null;
      const hasRequest = inv && inv.status !== null;
      return {
        ...c,
        inventoryRequest: hasRequest ? {
          requestId: c.inventoryItemId,
          status: inv.status,
          notes: inv.notes,
        } : null,
      };
    });
  }

  async removeComponent(caseId: string, compId: string) {
    await this.findCaseOrThrow(caseId);
    const comp = await this.prisma.prosthesisComponent.findFirst({ where: { id: compId, caseId } });
    if (!comp) throw new NotFoundException('Component not found');
    return this.prisma.prosthesisComponent.delete({ where: { id: compId } });
  }

  async approveComponent(caseId: string, compId: string) {
    await this.findCaseOrThrow(caseId);
    const comp = await this.prisma.prosthesisComponent.findFirst({ where: { id: compId, caseId } });
    if (!comp) throw new NotFoundException('Component not found');

    const approved = await this.prisma.prosthesisComponent.update({
      where: { id: compId },
      data: { isApproved: true, approvedAt: new Date() },
    });

    // إنشاء نموذج التسليم تلقائياً إذا ما موجود
    let form = await this.prisma.prostheticDeliveryForm.findUnique({ where: { caseId } });
    if (!form) form = await this.prisma.prostheticDeliveryForm.create({ data: { caseId } });

    // إضافة القطعة تلقائياً كـ item في التسليم
    await this.prisma.prostheticDeliveryItem.create({
      data: {
        formId:          form.id,
        deliveredProduct: (comp as any).partName,
        partCode:        (comp as any).partCode,
        company:         (comp as any).supplier,
        itemAddedDate:   new Date(),
      },
    });

    return approved;
  }

  // ── Gait Analysis ─────────────────────────────────────────────────────────

  async upsertGaitAnalysis(caseId: string, dto: GaitAnalysisDto) {
    await this.findCaseOrThrow(caseId);
    await this.autoAdvanceStatus(caseId, 'SOCKET_TRIAL'); // تسليم تجريبي (مدمج مع نموذج التسليم/إضافة القطعة)
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
    await this.autoAdvanceStatus(caseId, 'SOCKET_TRIAL'); // تسليم تجريبي (مدمج مع نموذج التسليم/إضافة القطعة)
    return this.prisma.balanceAssessmentForm.create({
      data: {
        caseId,
        assessmentDate:    dto.assessmentDate ? new Date(dto.assessmentDate) : undefined,
        previousProsthesis:      dto.previousProsthesis,
        previousProsthesisNotes: dto.previousProsthesisNotes,
        assistiveDevice:         dto.assistiveDevice,
        staticBalance:     dto.staticBalance ?? undefined,
        dynamicTasks:      dto.dynamicTasks ?? undefined,
        dynamicActivities: dto.dynamicActivities ?? undefined,
        historyOfFalls:    dto.historyOfFalls,
        nearFalls:         dto.nearFalls,
        fearOfFalling:     dto.fearOfFalling,
        fallRiskLevel:     dto.fallRiskLevel,
        fallRiskNotes:     dto.fallRiskNotes,
        overallBalanceLevel:          dto.overallBalanceLevel,
        limitingFactors:              dto.limitingFactors ?? [],
        limitingFactorsOtherNotes:    dto.limitingFactorsOtherNotes,
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
    if ((form as any).isSaved) throw new BadRequestException('النموذج محفوظ ولا يمكن تعديله');
    return this.prisma.balanceAssessmentForm.update({
      where: { id: formId },
      data: {
        assessmentDate:    dto.assessmentDate ? new Date(dto.assessmentDate) : undefined,
        previousProsthesis:      dto.previousProsthesis,
        previousProsthesisNotes: dto.previousProsthesisNotes,
        assistiveDevice:         dto.assistiveDevice,
        staticBalance:     dto.staticBalance ?? undefined,
        dynamicTasks:      dto.dynamicTasks ?? undefined,
        dynamicActivities: dto.dynamicActivities ?? undefined,
        historyOfFalls:    dto.historyOfFalls,
        nearFalls:         dto.nearFalls,
        fearOfFalling:     dto.fearOfFalling,
        fallRiskLevel:     dto.fallRiskLevel,
        fallRiskNotes:     dto.fallRiskNotes,
        overallBalanceLevel:          dto.overallBalanceLevel,
        limitingFactors:              dto.limitingFactors ?? [],
        limitingFactorsOtherNotes:    dto.limitingFactorsOtherNotes,
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

  async saveBalanceAssessmentForm(caseId: string, formId: string) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.balanceAssessmentForm.findFirst({ where: { id: formId, caseId } });
    if (!form) throw new NotFoundException('Balance assessment form not found');
    if ((form as any).isSaved) throw new BadRequestException('النموذج محفوظ مسبقاً');
    return this.prisma.balanceAssessmentForm.update({ where: { id: formId }, data: { isSaved: true } });
  }

  async archiveBalanceAssessmentForm(caseId: string, formId: string, reason: string) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.balanceAssessmentForm.findFirst({ where: { id: formId, caseId } });
    if (!form) throw new NotFoundException('Balance assessment form not found');
    if ((form as any).archivedAt) throw new BadRequestException('النموذج مؤرشف مسبقاً');
    return this.prisma.balanceAssessmentForm.update({
      where: { id: formId },
      data: { archivedAt: new Date(), archiveNotes: reason },
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
    await this.autoAdvanceStatus(caseId, 'SOCKET_TRIAL');
    const formData = {
      inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : undefined,
      prosthetistId:     dto.prosthetistId,
      physiotherapistId: dto.physiotherapistId,
      ceoId:             dto.ceoId,
      ceoSignatureUrl:   dto.ceoSignatureUrl,
      signatureDate: dto.signatureDate ? new Date(dto.signatureDate) : undefined,
      medicalDirectorId:           dto.medicalDirectorId,
      medicalDirectorSignatureUrl: dto.medicalDirectorSignatureUrl,
      medicalDirectorSignedAt: dto.medicalDirectorSignedAt ? new Date(dto.medicalDirectorSignedAt) : undefined,
    };
    return this.prisma.prostheticDeliveryForm.upsert({
      where: { caseId },
      create: { caseId, ...formData },
      update: formData,
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getDeliveryForm(caseId: string) {
    await this.findCaseOrThrow(caseId);
    await this.syncApprovedComponentsToDelivery(caseId);
    return this.prisma.prostheticDeliveryForm.findUnique({
      where: { caseId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  private async syncApprovedComponentsToDelivery(caseId: string) {
    const components = await this.prisma.prosthesisComponent.findMany({ where: { caseId } });
    if (!components.length) return;

    const itemIds = components.map((c: any) => c.inventoryItemId).filter(Boolean);
    if (!itemIds.length) return;

    const invItems = await this.prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `SELECT id, status::text AS status FROM clinic_inventory.inventory_items WHERE id = ANY($1::text[])`,
      itemIds,
    ).catch(() => [] as any[]);

    const approvedIds = new Set(invItems.filter(i => i.status === 'APPROVED').map(i => i.id));
    const approvedComponents = components.filter((c: any) => approvedIds.has(c.inventoryItemId));
    if (!approvedComponents.length) return;

    let form = await this.prisma.prostheticDeliveryForm.findUnique({ where: { caseId } });
    if (!form) form = await this.prisma.prostheticDeliveryForm.create({ data: { caseId } });

    const existingItems = await this.prisma.prostheticDeliveryItem.findMany({
      where: { formId: form.id, sourceComponentId: { not: null } },
      select: { sourceComponentId: true },
    });
    const alreadySynced = new Set(existingItems.map((i: any) => i.sourceComponentId));

    for (const comp of approvedComponents) {
      if (alreadySynced.has((comp as any).id)) continue;
      await this.prisma.prostheticDeliveryItem.create({
        data: {
          formId:           form.id,
          deliveredProduct: (comp as any).partName,
          partCode:         (comp as any).partCode,
          company:          (comp as any).supplier,
          sourceComponentId: (comp as any).id,
          itemAddedDate:    new Date(),
        },
      });
    }
  }

  async addDeliveryItem(caseId: string, dto: ProstheticDeliveryItemDto) {
    await this.findCaseOrThrow(caseId);
    await this.autoAdvanceStatus(caseId, 'SOCKET_TRIAL');
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
        itemAddedDate:   dto.itemAddedDate ? new Date(dto.itemAddedDate) : undefined,
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
        itemAddedDate:   dto.itemAddedDate ? new Date(dto.itemAddedDate) : undefined,
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

  // ── التسليم النهائي (FINAL) — entity مستقلة ─────────────────────────────

  async createFinalDelivery(caseId: string, dto: FinalDeliveryFormDto, userId?: string, userName?: string) {
    await this.findCaseOrThrow(caseId);
    await this.autoAdvanceStatus(caseId, 'DELIVERED'); // تم التسليم
    const existing = await this.prisma.finalDeliveryForm.findUnique({ where: { caseId } });
    if (existing) throw new BadRequestException('التسليم النهائي موجود مسبقاً — استخدم PATCH للتعديل');

    // نسخ القطع المعتمدة من التسليم التجريبي تلقائياً
    const trialForm = await this.prisma.prostheticDeliveryForm.findUnique({
      where: { caseId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });

    const formData = {
      caseId,
      createdBy: userId,
      createdByName: userName,
      inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : trialForm?.inspectionDate,
      prosthetistId:     dto.prosthetistId     ?? trialForm?.prosthetistId,
      physiotherapistId: dto.physiotherapistId ?? trialForm?.physiotherapistId,
      ceoId:             dto.ceoId             ?? trialForm?.ceoId,
      ceoSignatureUrl:   dto.ceoSignatureUrl   ?? trialForm?.ceoSignatureUrl,
      signatureDate: dto.signatureDate ? new Date(dto.signatureDate) : trialForm?.signatureDate,
      medicalDirectorId:           dto.medicalDirectorId           ?? trialForm?.medicalDirectorId,
      medicalDirectorSignatureUrl: dto.medicalDirectorSignatureUrl ?? trialForm?.medicalDirectorSignatureUrl,
      medicalDirectorSignedAt: dto.medicalDirectorSignedAt ? new Date(dto.medicalDirectorSignedAt) : trialForm?.medicalDirectorSignedAt,
      items: trialForm?.items?.length
        ? {
            create: (trialForm.items as any[]).map(i => ({
              deliveredProduct: i.deliveredProduct,
              partCode:        i.partCode,
              quantity:        i.quantity,
              company:         i.company,
              notes:           i.notes,
              itemAddedDate:   i.itemAddedDate,
            })),
          }
        : undefined,
    };

    return this.prisma.finalDeliveryForm.create({
      data: formData,
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getFinalDelivery(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.finalDeliveryForm.findUnique({
      where: { caseId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async updateFinalDelivery(caseId: string, dto: FinalDeliveryFormDto) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.finalDeliveryForm.findUnique({ where: { caseId } });
    if (!form) throw new NotFoundException('التسليم النهائي غير موجود — أنشئه أولاً');
    return this.prisma.finalDeliveryForm.update({
      where: { caseId },
      data: {
        inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : undefined,
        prosthetistId:     dto.prosthetistId,
        physiotherapistId: dto.physiotherapistId,
        ceoId:             dto.ceoId,
        ceoSignatureUrl:   dto.ceoSignatureUrl,
        signatureDate: dto.signatureDate ? new Date(dto.signatureDate) : undefined,
        medicalDirectorId:           dto.medicalDirectorId,
        medicalDirectorSignatureUrl: dto.medicalDirectorSignatureUrl,
        medicalDirectorSignedAt: dto.medicalDirectorSignedAt ? new Date(dto.medicalDirectorSignedAt) : undefined,
      },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async approveDeliveryItem(caseId: string, itemId: string) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.prostheticDeliveryForm.findUnique({ where: { caseId } });
    if (!form) throw new NotFoundException('Delivery form not found');
    const item = await this.prisma.prostheticDeliveryItem.findFirst({ where: { id: itemId, formId: form.id } });
    if (!item) throw new NotFoundException('Item not found');
    return this.prisma.prostheticDeliveryItem.update({
      where: { id: itemId },
      data: { isApproved: true, approvedAt: new Date() },
    });
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
    const finalDelivery = await this.prisma.finalDeliveryForm.findUnique({ where: { caseId } });
    if (finalDelivery) throw new BadRequestException('لا يمكن إضافة جلسات بعد إتمام التسليم النهائي');
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

  async archiveCaseTreatmentProgram(caseId: string, programId: string, notes?: string) {
    await this.findCaseOrThrow(caseId);
    const program = await this.prisma.caseTreatmentProgram.findFirst({ where: { id: programId, caseId } });
    if (!program) throw new NotFoundException('Treatment program not found');
    if ((program as any).archivedAt) throw new BadRequestException('الجلسة مؤرشفة مسبقاً');
    return this.prisma.caseTreatmentProgram.update({
      where: { id: programId },
      data: { archivedAt: new Date(), archiveNotes: notes ?? null },
    });
  }

  private async getUsersByJobTitle(code: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT e."userId" FROM users.employees e
       JOIN users.job_titles jt ON jt.id = e."jobTitleId"
       WHERE jt.code = $1 AND e."deletedAt" IS NULL`,
      code,
    ).catch(() => [] as Array<{ userId: string }>);
    return rows.map(r => r.userId).filter(Boolean);
  }

  async createTreatmentProgramFromAppointment(caseId: string, sessionDate: Date, sessionTime: string, appointmentType?: string, appointmentId?: string) {
    const cs = await this.prisma.prostheticsCase.findFirst({ where: { id: caseId, deletedAt: null } });
    if (!cs) return null;
    return this.prisma.caseTreatmentProgram.create({
      data: { caseId, sessionDate, sessionTime, appointmentType: appointmentType ?? null, appointmentId: appointmentId ?? null },
    });
  }

  // عند إنجاز الموعد: وقت الخروج يُكتب فقط إن بدأت الجلسة ولم يُدخَل وقت خروج يدوياً
  async setTreatmentProgramEndFromAppointment(appointmentId: string, sessionEndTime: string) {
    if (!appointmentId || !sessionEndTime) return { count: 0 };
    return this.prisma.caseTreatmentProgram.updateMany({
      where: {
        appointmentId,
        AND: [
          { sessionStartTime: { not: null } },
          { sessionStartTime: { not: '' } },
          { OR: [{ sessionEndTime: null }, { sessionEndTime: '' }] },
        ],
      },
      data: { sessionEndTime },
    });
  }

  async alertCase(caseId: string, note: string, userId: string) {
    await this.findCaseOrThrow(caseId);

    const alert = await this.prisma.caseAlert.create({
      data: { caseId, note, sentByUserId: userId },
    });

    const headIds = await this.getUsersByJobTitle('VTX-JTL-000035');
    for (const headId of headIds) {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO users.notifications
           (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
         VALUES
           (gen_random_uuid(), $1, 'GENERAL', 'تنبيه من برنامج المتابعة', 'Treatment Program Alert', $2, $2, $3::jsonb, false, NOW())`,
        headId, note,
        JSON.stringify({ caseId, alertId: alert.id, type: 'CASE_ALERT' }),
      ).catch(() => {});
    }

    return alert;
  }

  async getCaseAlerts(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.caseAlert.findMany({
      where: { caseId },
      orderBy: { sentAt: 'desc' },
    });
  }

  async respondToCaseAlert(caseId: string, alertId: string, responseNote: string) {
    await this.findCaseOrThrow(caseId);
    const alert = await this.prisma.caseAlert.findFirst({ where: { id: alertId, caseId } });
    if (!alert) throw new NotFoundException('التنبيه غير موجود');

    const updated = await this.prisma.caseAlert.update({
      where: { id: alertId },
      data: { responseNote, respondedAt: new Date() },
    });

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO users.notifications
         (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
       VALUES
         (gen_random_uuid(), $1, 'GENERAL', 'رد على تنبيه برنامج المتابعة', 'Alert Response', $2, $2, $3::jsonb, false, NOW())`,
      alert.sentByUserId, responseNote,
      JSON.stringify({ caseId, alertId, type: 'CASE_ALERT_RESPONSE' }),
    ).catch(() => {});

    return updated;
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

  async createFinalEvaluation(caseId: string, dto: FinalEvaluationDto, userId?: string, userName?: string) {
    await this.findCaseOrThrow(caseId);
    await this.autoAdvanceStatus(caseId, 'FINAL_REVIEW'); // جاهز للتسليم
    const data: any = {
      createdBy: userId,
      createdByName: userName,
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
      managerNotes:                 dto.managerNotes,
      patientFileComplete:          dto.patientFileComplete,
    };
    return this.prisma.finalEvaluation.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
  }

  async patchFinalEvaluation(caseId: string, dto: any, userId: string, userName: string | null) {
    await this.findCaseOrThrow(caseId);
    const existing = await this.prisma.finalEvaluation.findUnique({ where: { caseId } });
    if (existing?.medicalDirectorSignedAt) {
      throw new ConflictException({ code: 'EVALUATION_LOCKED', message: 'Final evaluation is locked after director sign' });
    }
    const now = new Date();
    const data: any = {};
    const opinions = [
      ['physioOpinion',                'physioOpinionBy',                'physioOpinionByName',                'physioOpinionAt'],
      ['departmentHeadOpinion',        'departmentHeadOpinionBy',        'departmentHeadOpinionByName',        'departmentHeadOpinionAt'],
      ['prosthetistOpinion',           'prosthetistOpinionBy',           'prosthetistOpinionByName',           'prosthetistOpinionAt'],
      ['prosthetistSupervisorOpinion', 'prosthetistSupervisorOpinionBy', 'prosthetistSupervisorOpinionByName', 'prosthetistSupervisorOpinionAt'],
      ['committeeHeadOpinion',         'committeeHeadOpinionBy',         'committeeHeadOpinionByName',         'committeeHeadOpinionAt'],
      ['expertOpinion',                'expertOpinionBy',                'expertOpinionByName',                'expertOpinionAt'],
    ];
    for (const [opinionKey, byKey, byNameKey, atKey] of opinions) {
      if (dto[opinionKey] !== undefined) {
        data[opinionKey] = dto[opinionKey];
        // فقط إذا القيمة فعلاً تغيّرت عن المخزّن نسجّل مين كتبها ومتى —
        // منعاً من تسجيل اسم آخر شخص حفظ أي حقل تاني فوق حقل ما تغيّر
        if (dto[opinionKey] !== (existing as any)?.[opinionKey]) {
          data[byKey]     = userId;
          data[byNameKey] = userName;
          data[atKey]     = now;
        }
      }
    }
    // حقول التقييم الأساسية
    if (dto.residualLimbCondition !== undefined) data.residualLimbCondition = dto.residualLimbCondition;
    if (dto.suspensionSystemUsed  !== undefined) data.suspensionSystemUsed  = dto.suspensionSystemUsed;
    if (dto.socksDelivered        !== undefined) data.socksDelivered        = dto.socksDelivered;
    if (dto.linersDelivered       !== undefined) data.linersDelivered       = dto.linersDelivered;
    if (dto.fittingDate           !== undefined) data.fittingDate           = dto.fittingDate ? new Date(dto.fittingDate) : null;
    if (dto.generalNotes          !== undefined) data.generalNotes          = dto.generalNotes;
    if (dto.supervisorId          !== undefined) data.supervisorId          = dto.supervisorId;
    // اعتماد المدير الطبي — حقول مستقلة عن آراء اللجنة أعلاه
    if (dto.medicalDirectorNotes !== undefined) data.medicalDirectorNotes = dto.medicalDirectorNotes;
    if (dto.readyForDelivery     !== undefined) data.readyForDelivery     = dto.readyForDelivery;
    if (dto.needsFollowUp        !== undefined) data.needsFollowUp        = dto.needsFollowUp;
    if (dto.followUpPlan         !== undefined) data.followUpPlan         = dto.followUpPlan;
    // تدقيق المدير
    if (dto.managerNotes         !== undefined) data.managerNotes         = dto.managerNotes;
    if (dto.patientFileComplete  !== undefined) data.patientFileComplete  = dto.patientFileComplete;
    if (Object.keys(data).length === 0) {
      return existing ? { ...existing, isLocked: !!existing.medicalDirectorSignedAt } : null;
    }
    const result = await this.prisma.finalEvaluation.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
    return { ...result, isLocked: !!result.medicalDirectorSignedAt };
  }

  async getFinalEvaluation(caseId: string) {
    await this.findCaseOrThrow(caseId);
    const record = await this.prisma.finalEvaluation.findUnique({ where: { caseId } });
    if (!record) return null;
    return { ...record, isLocked: !!record.medicalDirectorSignedAt };
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
    let result: any;
    if (!existing) {
      result = await this.prisma.finalEvaluation.create({
        data: { caseId, supervisorId: userId, ...data },
      });
    } else {
      result = await this.prisma.finalEvaluation.update({ where: { caseId }, data });
    }
    return { ...result, isLocked: !!result.medicalDirectorSignedAt };
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
    await this.autoAdvanceStatus(caseId, 'FOLLOW_UP');
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

  async getTimeline(caseId: string, query: TimelineQueryDto = {}) {
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

    // ── الشكل الجديد (stages + items) — يُضاف بجانب timeline القديم بدون تغييره ──
    const history = await this.prisma.caseStageHistory.findMany({
      where: { caseId },
      orderBy: { changedAt: 'asc' },
    }).catch(() => [] as Array<{ id: string; fromStatus: string | null; toStatus: string; source: string; reason: string | null; changedBy: string | null; changedAt: Date }>);

    const actors = await this.resolveActors(history.map((h) => h.changedBy));
    const actorName = (id: string | null) => (id && actors[id] ? actors[id].name : null);

    const stages = this.buildStages(history, c.status as string, actorName);

    type Item = {
      id: string; caseId: string; type: string; stage: string | null; action: string;
      title: string; description: string | null; date: Date;
      actorId: string | null; actorName: string | null; actorRole: string | null;
      changes: Array<{ field: string; oldValue: any; newValue: any }>; metadata: Record<string, any>;
    };
    const items: Item[] = [];

    // أحداث مشتقة من السجلات الفرعية (نفس timeline القديم)
    events.forEach((e, i) => {
      const type = e.type.toUpperCase();
      items.push({
        id: `${type}:${e.date.toISOString()}:${i}`, caseId, type, stage: null,
        action: type.endsWith('_SIGNED') ? 'SIGN' : 'CREATE',
        title: e.title, description: e.description ?? null, date: e.date,
        actorId: null, actorName: null, actorRole: null, changes: [], metadata: {},
      });
    });

    // تغييرات المرحلة من تاريخ المراحل (حدث الإنشاء موجود أصلاً كـ CASE_CREATED)
    for (const h of history) {
      if (h.source === 'CREATE') continue;
      items.push({
        id: h.id, caseId, type: 'STATUS_CHANGED', stage: h.toStatus, action: 'STATUS_CHANGE',
        title: 'تغيير المرحلة', description: `${h.fromStatus ?? '—'} → ${h.toStatus}`, date: h.changedAt,
        actorId: h.changedBy, actorName: actorName(h.changedBy),
        actorRole: h.changedBy && actors[h.changedBy] ? actors[h.changedBy].role : null,
        changes: [],
        metadata: { fromStatus: h.fromStatus, toStatus: h.toStatus, reason: h.reason, source: h.source },
      });
    }

    // فلاتر اختيارية
    const fromDate = this.parseTimelineBound(query.from, false);
    const toDate   = this.parseTimelineBound(query.to, true);
    let filtered = items.filter((it) =>
      (!query.stage   || it.stage === query.stage) &&
      (!query.type    || it.type === query.type) &&
      (!query.actorId || it.actorId === query.actorId) &&
      (!fromDate      || it.date >= fromDate) &&
      (!toDate        || it.date < toDate),
    );
    filtered.sort((a, b) => b.date.getTime() - a.date.getTime()); // الأحدث أولاً

    const page  = query.page  ?? 1;
    const limit = query.limit ?? 50;
    const total = filtered.length;
    filtered = filtered.slice((page - 1) * limit, page * limit);

    return {
      caseId, caseNumber: c.caseNumber,
      timeline: events,   // الشكل القديم — بدون تغيير
      stages, items: filtered, total, page, limit,
    };
  }

  // ملخص المراحل من تاريخ المراحل. enteredAt = null يعني دخول قبل بدء التتبع (غير معروف).
  private buildStages(
    history: Array<{ fromStatus: string | null; toStatus: string; changedBy: string | null; changedAt: Date }>,
    currentStatus: string,
    actorName: (id: string | null) => string | null,
  ) {
    type Stage = {
      stage: string; enteredAt: Date | null; exitedAt: Date | null; durationMinutes: number | null;
      enteredBy: string | null; enteredByName: string | null; exitedBy: string | null; exitedByName: string | null;
    };
    const seg = (stage: string, enteredAt: Date | null, enteredBy: string | null): Stage => ({
      stage, enteredAt, exitedAt: null, durationMinutes: null,
      enteredBy, enteredByName: actorName(enteredBy), exitedBy: null, exitedByName: null,
    });
    const close = (s: Stage, at: Date, by: string | null) => {
      s.exitedAt = at; s.exitedBy = by; s.exitedByName = actorName(by);
      s.durationMinutes = s.enteredAt ? Math.round((at.getTime() - s.enteredAt.getTime()) / 60000) : null;
    };

    const stages: Stage[] = [];
    for (const h of history) {
      const prev = stages[stages.length - 1];
      if (prev) close(prev, h.changedAt, h.changedBy);
      else if (h.fromStatus) {
        // أول تغيير مسجّل لحالة قديمة — المرحلة السابقة دخلت قبل بدء التتبع
        const before = seg(h.fromStatus, null, null);
        close(before, h.changedAt, h.changedBy);
        stages.push(before);
      }
      stages.push(seg(h.toStatus, h.changedAt, h.changedBy));
    }
    // لا تاريخ، أو المرحلة الحالية تغيّرت خارج التطبيق → مرحلة حالية بدخول غير معروف
    const last = stages[stages.length - 1];
    if (!last || last.stage !== currentStatus) stages.push(seg(currentStatus, null, null));
    return stages;
  }

  // YYYY-MM-DD = حدود اليوم بتوقيت سوريا؛ غير ذلك يُقرأ كتاريخ ISO
  private parseTimelineBound(v: string | undefined, isEnd: boolean): Date | null {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(`${v}T00:00:00+03:00`);
      if (isEnd) d.setUTCDate(d.getUTCDate() + 1);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  // اسم الموظف ومسمّاه الوظيفي من رقم المستخدم
  private async resolveActors(userIds: Array<string | null | undefined>) {
    const ids = [...new Set(userIds.filter(Boolean) as string[])];
    const map: Record<string, { name: string; role: string | null }> = {};
    if (ids.length === 0) return map;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string; firstNameAr: string; lastNameAr: string; role: string | null }>>(
      `SELECT u.id as "userId", e."firstNameAr", e."lastNameAr", jt."nameAr" as role
       FROM users.users u
       JOIN users.employees e ON e."userId" = u.id
       LEFT JOIN users.job_titles jt ON jt.id = e."jobTitleId"
       WHERE u.id = ANY($1::text[])`,
      ids,
    ).catch(() => []);
    for (const r of rows) map[r.userId] = { name: `${r.firstNameAr ?? ''} ${r.lastNameAr ?? ''}`.trim(), role: r.role };
    return map;
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
    await this.autoAdvanceStatus(caseId, 'SOCKET_TRIAL'); // تسليم تجريبي (مدمج مع نموذج التسليم/إضافة القطعة)
    return this.prisma.gaitAnalysisForm.create({
      data: {
        caseId,
        sessionDate:              dto.sessionDate ? new Date(dto.sessionDate) : undefined,
        suspensionSystem:         dto.suspensionSystem ?? [],
        socketBearing:            dto.socketBearing,
        kneeJointType:            dto.kneeJointType,
        footType:                 dto.footType,
        patientComplaints:           dto.patientComplaints ?? [],
        patientComplaintsOtherNotes: dto.patientComplaintsOtherNotes,
        suspensionSystemOtherNotes:  dto.suspensionSystemOtherNotes,
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
        prostheticIssues:           dto.prostheticIssues ?? [],
        prostheticIssuesOtherNotes: dto.prostheticIssuesOtherNotes,
        mainProblem:              dto.mainProblem,
        mainProblemNotes:         dto.mainProblemNotes,
        likelyCauses:             dto.likelyCauses ?? [],
        likelyCausesOtherNotes:   dto.likelyCausesOtherNotes,
        recommendations:          dto.recommendations ?? [],
        recommendationsNotes:     dto.recommendationsNotes,
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
    if ((form as any).isSaved) throw new BadRequestException('النموذج محفوظ ولا يمكن تعديله');
    return this.prisma.gaitAnalysisForm.update({
      where: { id: formId },
      data: {
        sessionDate:              dto.sessionDate ? new Date(dto.sessionDate) : undefined,
        suspensionSystem:         dto.suspensionSystem,
        socketBearing:            dto.socketBearing,
        kneeJointType:            dto.kneeJointType,
        footType:                 dto.footType,
        patientComplaints:        dto.patientComplaints,
        patientComplaintsOtherNotes: dto.patientComplaintsOtherNotes,
        suspensionSystemOtherNotes:  dto.suspensionSystemOtherNotes,
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
        prostheticIssuesOtherNotes: dto.prostheticIssuesOtherNotes,
        mainProblem:              dto.mainProblem,
        mainProblemNotes:         dto.mainProblemNotes,
        likelyCauses:             dto.likelyCauses,
        likelyCausesOtherNotes:   dto.likelyCausesOtherNotes,
        recommendations:          dto.recommendations,
        recommendationsNotes:     dto.recommendationsNotes,
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

  async saveGaitAnalysisForm(caseId: string, formId: string) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.gaitAnalysisForm.findFirst({ where: { id: formId, caseId } });
    if (!form) throw new NotFoundException('Gait analysis form not found');
    if ((form as any).isSaved) throw new BadRequestException('النموذج محفوظ مسبقاً');
    return this.prisma.gaitAnalysisForm.update({ where: { id: formId }, data: { isSaved: true } });
  }

  async archiveGaitAnalysisForm(caseId: string, formId: string, reason: string) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.gaitAnalysisForm.findFirst({ where: { id: formId, caseId } });
    if (!form) throw new NotFoundException('Gait analysis form not found');
    if ((form as any).archivedAt) throw new BadRequestException('النموذج مؤرشف مسبقاً');
    return this.prisma.gaitAnalysisForm.update({
      where: { id: formId },
      data: { archivedAt: new Date(), archiveNotes: reason },
    });
  }

  async deleteGaitAnalysisForm(caseId: string, formId: string) {
    await this.findCaseOrThrow(caseId);
    const form = await this.prisma.gaitAnalysisForm.findFirst({ where: { id: formId, caseId } });
    if (!form) throw new NotFoundException('Gait analysis form not found');
    return this.prisma.gaitAnalysisForm.delete({ where: { id: formId } });
  }
}
