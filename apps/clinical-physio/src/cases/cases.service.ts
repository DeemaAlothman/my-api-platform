import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePhysioCaseDto, UpdatePhysioCaseDto, UpdatePhysioStatusDto, ListPhysioCasesQueryDto,
  ComplaintDto, EvaluationDto, PainMapDto, MedicalHistoryDto, SurgeryDto, TreatmentGoalsDto,
  PosturalAssessmentDto, TreatmentPlanDto, SupervisorReviewDto, DoctorReviewDto, PlanSignDto,
  PhysioSessionDto, UpdateSessionDto, FinalSummaryDto,
  PhysioFollowUpDto, UpdateFollowUpDto, CaseType,
} from './dto/physio-case.dto';

// B11: خريطة الانتقالات المسموحة لحالة الملف
// الترتيب: استقبال → شكوى → خريطة الألم → التاريخ الطبي → أهداف العلاج →
// خطة العلاج (Assessment) → خطة العلاج (Treatment) → التقييم → الجلسات العلاجية →
// رأي رئيس القسم → مكتمل. (أُلغي التوقيع/DOCTOR_SIGN نهائياً.)
const DOCTOR_EXAM_TRANSITIONS: Record<string, string[]> = {
  INTAKE:    ['COMPLAINT', 'CANCELLED'],
  COMPLAINT: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  INTAKE:              ['COMPLAINT', 'CANCELLED'],
  COMPLAINT:           ['PAIN_MAP', 'CANCELLED'],
  PAIN_MAP:            ['MEDICAL_HISTORY', 'CANCELLED'],
  MEDICAL_HISTORY:     ['GOALS', 'CANCELLED'],
  GOALS:               ['POSTURAL_ASSESSMENT', 'CANCELLED'],
  POSTURAL_ASSESSMENT: ['TREATMENT_PLAN', 'CANCELLED'], // خطة العلاج (Assessment)
  TREATMENT_PLAN:      ['EVALUATION', 'CANCELLED'],      // خطة العلاج (Treatment)
  EVALUATION:          ['ACTIVE_TREATMENT', 'CANCELLED'], // التقييم
  ACTIVE_TREATMENT:    ['SUPERVISOR_REVIEW', 'CANCELLED'], // الجلسات العلاجية
  SUPERVISOR_REVIEW:   ['DOCTOR_REVIEW', 'CANCELLED'],     // رأي رئيس القسم
  DOCTOR_REVIEW:       ['COMPLETED', 'CANCELLED'],         // رأي الطبيب
  COMPLETED:           ['DISCHARGED'],                     // مكتمل
  DISCHARGED:          [],
  CANCELLED:           [],
  // DOCTOR_SIGN: مُلغى — لم يعد جزءاً من المسار
};

const PATIENTS_URL = process.env.PATIENTS_SERVICE_URL || 'http://localhost:4010';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  // B12: تحقق من وجود المريض عبر خدمة المرضى (نقطة داخلية)
  private async assertPatientExists(patientId: string): Promise<void> {
    try {
      const res = await fetch(`${PATIENTS_URL}/api/v1/patients/internal/${patientId}/exists`, {
        method: 'GET',
        headers: { 'x-internal-token': INTERNAL_TOKEN },
      });
      if (res.ok) {
        const json: any = await res.json();
        const exists = json?.data?.exists ?? json?.exists;
        if (exists) return;
      }
    } catch {
      // فشل الاتصال → نعامله كعدم وجود (فشل مغلق)
    }
    throw new BadRequestException({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
  }

  private async findCaseOrThrow(id: string) {
    const c = await this.prisma.physioCase.findFirst({ where: { id, deletedAt: null } });
    if (!c) throw new NotFoundException('Physio case not found');
    return c;
  }

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

  // ── Cases CRUD ────────────────────────────────────────────────────────────

  async create(dto: CreatePhysioCaseDto, userId: string) {
    // B12: تأكد من وجود المريض قبل إنشاء الحالة
    await this.assertPatientExists(dto.patientId);

    // إنشاء حالة PHYSIO مباشرة ممنوع — يجب المرور عبر معاينة طبيب ثم convert-to-physio
    if (!dto.caseType || dto.caseType === CaseType.PHYSIO) {
      throw new BadRequestException(
        'لإنشاء حالة علاج فيزيائي يجب البدء بمعاينة طبيب ثم اختيار التحويل',
      );
    }

    // B15: توليد caseNumber آمن داخل transaction مع advisory lock يمنع التكرار عند التزامن
    const caseTypeValue = dto.caseType;
    const prefix = caseTypeValue === CaseType.DOCTOR_EXAM ? 'DE' : 'PT';

    return this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', year);

      const last = await tx.physioCase.findFirst({
        where: { caseNumber: { startsWith: `${prefix}-${year}-` } },
        orderBy: { caseNumber: 'desc' },
        select: { caseNumber: true },
      });
      const lastSeq = last ? parseInt(last.caseNumber.split('-')[2], 10) : 0;
      const caseNumber = `${prefix}-${year}-${String(lastSeq + 1).padStart(4, '0')}`;

      return tx.physioCase.create({
        data: {
          caseNumber,
          caseType: caseTypeValue as any,
          patientId: dto.patientId,
          majorComplaint: dto.majorComplaint,
          symptoms: dto.symptoms,
          currentJob: dto.currentJob,
          lifeType: dto.lifeType as any,
          complaintStartDate: dto.complaintStartDate,
          possibleCause: dto.possibleCause,
          previousDoctorSeen: dto.previousDoctorSeen,
          previousTreatment: dto.previousTreatment,
          hadPreviousPT: dto.hadPreviousPT ?? false,
          hadPreviousInjury: dto.hadPreviousInjury,
          painStartDate: dto.painStartDate ? new Date(dto.painStartDate) : undefined,
          painLevel: dto.painLevel as any,
          painDuration: dto.painDuration as any,
          painProgression: dto.painProgression,
          bestTimeOfDay: dto.bestTimeOfDay,
          worstTimeOfDay: dto.worstTimeOfDay,
          painTypes: (dto.painTypes ?? []) as any,
          aggravatingFactors: (dto.aggravatingFactors ?? []) as any,
          aggravatingOther: dto.aggravatingOther,
          alleviatingFactors: (dto.alleviatingFactors ?? []) as any,
          alleviatingOther: dto.alleviatingOther,
          physiotherapistId: dto.physiotherapistId,
          supervisingDoctorId: dto.supervisingDoctorId,
          caseManagerId: dto.caseManagerId,
          treatmentFrom: dto.treatmentFrom,
          treatmentTo: dto.treatmentTo,
          anticipatedVisits: dto.anticipatedVisits,
          createdBy: userId,
        },
      });
    });
  }

  async findAll(query: ListPhysioCasesQueryDto) {
    const { page = 1, limit = 20, patientId, status, caseType, physiotherapistId } = query;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (caseType) where.caseType = caseType;
    if (physiotherapistId) where.physiotherapistId = physiotherapistId;

    const [items, total] = await Promise.all([
      this.prisma.physioCase.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          treatmentPlan: { select: { id: true, status: true } },
          _count: { select: { sessions: true } },
        },
      }),
      this.prisma.physioCase.count({ where }),
    ]);
    const nameMap = await this.resolvePatientNames(items.map((i) => i.patientId));
    const enriched = items.map((i) => ({ ...i, patient: nameMap[i.patientId] ?? null }));
    return { items: enriched, total, page, limit };
  }

  async findOne(id: string) {
    const c = await this.prisma.physioCase.findFirst({
      where: { id, deletedAt: null },
      include: {
        painMap: true,
        medicalHistory: { include: { surgeries: { orderBy: { order: 'asc' } } } },
        treatmentGoals: true,
        posturalAssessment: true,
        treatmentPlan: true,
        sessions: { orderBy: { sessionDate: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Physio case not found');
    const nameMap = await this.resolvePatientNames([c.patientId]);
    // التقييم مخزّن على الحالة — نرجّعه ككائن evaluation (نفس الشكل السابق)
    const evaluation = {
      modalities: c.evalModalities,
      otherModality: c.evalOtherModality,
      notes: c.evalNotes,
      evaluation: c.evalSummary,
    };
    return { ...c, evaluation, patient: nameMap[c.patientId] ?? null };
  }

  async update(id: string, dto: UpdatePhysioCaseDto) {
    await this.findCaseOrThrow(id);
    return this.prisma.physioCase.update({
      where: { id },
      data: {
        currentJob: dto.currentJob,
        lifeType: dto.lifeType as any,
        majorComplaint: dto.majorComplaint,
        symptoms: dto.symptoms,
        possibleCause: dto.possibleCause,
        complaintStartDate: dto.complaintStartDate,
        physiotherapistId: dto.physiotherapistId,
        supervisingDoctorId: dto.supervisingDoctorId,
        caseManagerId: dto.caseManagerId,
        treatmentFrom: dto.treatmentFrom,
        treatmentTo: dto.treatmentTo,
        anticipatedVisits: dto.anticipatedVisits,
        finalNotes: dto.finalNotes,
        hadPreviousInjury: dto.hadPreviousInjury,
        painProgression: dto.painProgression,
      },
    });
  }

  async updateStatus(id: string, dto: UpdatePhysioStatusDto) {
    const current = await this.findCaseOrThrow(id);
    const from = current.status as string;
    const to = dto.status as string;

    // B11: تحقق أن الانتقال مسموح ضمن آلة الحالات
    const transitionMap = (current as any).caseType === 'DOCTOR_EXAM'
      ? DOCTOR_EXAM_TRANSITIONS
      : STATUS_TRANSITIONS;
    const allowed = transitionMap[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_TRANSITION',
        message: `Transition from ${from} to ${to} is not allowed`,
        details: [{ from, to, allowed }],
      });
    }

    // أُلغي اشتراط توقيع الطبيب نهائياً — لا قيود توقيع على بدء العلاج

    return this.prisma.physioCase.update({
      where: { id },
      data: {
        status: to as any,
        ...(to === 'CANCELLED' && dto.cancellationReason
          ? { cancellationReason: dto.cancellationReason }
          : {}),
      },
    });
  }

  async findByPatient(patientId: string) {
    const items = await this.prisma.physioCase.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        treatmentPlan: { select: { status: true } },
        _count: { select: { sessions: true } },
      },
    });
    const nameMap = await this.resolvePatientNames([patientId]);
    return items.map((i) => ({ ...i, patient: nameMap[patientId] ?? null }));
  }

  // نقطة داخلية (خدمة-لخدمة): حذف ناعم لكل حالات العلاج الفيزيائي لمريض محذوف
  async deleteByPatientInternal(patientId: string) {
    const result = await this.prisma.physioCase.updateMany({
      where: { patientId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { deletedCount: result.count };
  }

  // ── الشكوى المرضية (Medical Complaint) ──────────────────────────────────────

  async upsertComplaint(caseId: string, dto: ComplaintDto) {
    await this.findCaseOrThrow(caseId);
    // نمرّر فقط الحقول المُرسلة (undefined لا يغيّر القيمة الحالية)
    const data: any = {
      majorComplaint: dto.majorComplaint,
      symptoms: dto.symptoms,
      currentJob: dto.currentJob,
      lifeType: dto.lifeType,
      complaintStartDate: dto.complaintStartDate,
      possibleCause: dto.possibleCause,
      complaintType: dto.complaintType,
      painLocation: dto.painLocation,
      complaintDuration: dto.complaintDuration,
      complaintNotes: dto.complaintNotes,
      painLevel: dto.painLevel,
      painDuration: dto.painDuration,
      painProgression: dto.painProgression,
      hadPreviousInjury: dto.hadPreviousInjury,
      bestTimeOfDay: dto.bestTimeOfDay,
      worstTimeOfDay: dto.worstTimeOfDay,
      hasChronicDiseases: dto.hasChronicDiseases,
      // التفصيل يُمسح إذا كان الجواب "لا"
      chronicDiseasesDetail: dto.hasChronicDiseases === false ? null : dto.chronicDiseasesDetail,
      visitedSpecialist: dto.visitedSpecialist,
      // يقبل previousDoctorSeen مباشرة أو specialistReason (alias قديم)
      previousDoctorSeen: dto.visitedSpecialist === false ? null : (dto.previousDoctorSeen ?? dto.specialistReason),
      hadPreviousPT: dto.hadPreviousPT,
      // يقبل previousTreatment مباشرة أو previousPTDetail (alias قديم)
      previousTreatment: dto.hadPreviousPT === false ? null : (dto.previousTreatment ?? dto.previousPTDetail),
      hadSurgery: dto.hadSurgery,
      surgeryDetail: dto.hadSurgery === false ? null : dto.surgeryDetail,
    };
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    return this.prisma.physioCase.update({ where: { id: caseId }, data });
  }

  // أنواع الألم المرجعية (النوع + الاسم + اللون). "أخرى" بدون لون — الفرونت يحدّده.
  getPainTypes() {
    return [
      { type: 'NORMAL',         name: 'عادي',      color: '#F44336' }, // أحمر
      { type: 'NUMBNESS',       name: 'خدر',       color: '#4CAF50' }, // أخضر
      { type: 'DULL_ACHE',      name: 'ألم خفيف',  color: '#FF9800' }, // برتقالي
      { type: 'HOT_BURNING',    name: 'حارق',      color: '#E91E63' }, // زهري
      { type: 'SHARP_STABBING', name: 'حاد',       color: '#9C27B0' }, // موف
      { type: 'PINS',           name: 'واخز',      color: '#FFEB3B' }, // أصفر
      { type: 'OTHER',          name: 'أخرى',      color: null, custom: true }, // الفرونت يحدّد الاسم واللون
    ];
  }

  // ── Pain Map ──────────────────────────────────────────────────────────────

  async upsertPainMap(caseId: string, dto: PainMapDto) {
    await this.findCaseOrThrow(caseId);

    // أنواع الألم والعوامل المحرّضة/المخفّفة مُخزّنة على الحالة نفسها
    const caseData: any = {
      painTypes: dto.painTypes as any,
      painTypeOther: dto.painTypeOther,
      painTypeOtherColor: dto.painTypeOtherColor,
      customPainTypes: dto.customPainTypes !== undefined ? dto.customPainTypes : undefined,
      aggravatingFactors: dto.aggravatingFactors as any,
      aggravatingOther: dto.aggravatingOther,
      alleviatingFactors: dto.alleviatingFactors as any,
      alleviatingOther: dto.alleviatingOther,
    };
    Object.keys(caseData).forEach((k) => caseData[k] === undefined && delete caseData[k]);
    if (Object.keys(caseData).length > 0) {
      await this.prisma.physioCase.update({ where: { id: caseId }, data: caseData });
    }

    return this.prisma.painMap.upsert({
      where: { caseId },
      create: { caseId, regions: (dto.regions ?? []) as any, notes: dto.notes },
      update: {
        ...(dto.regions !== undefined ? { regions: dto.regions as any } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  // ── Medical History ───────────────────────────────────────────────────────

  async upsertMedicalHistory(caseId: string, dto: MedicalHistoryDto) {
    await this.findCaseOrThrow(caseId);

    // 1) نمط الحياة مُخزّن على الحالة نفسها
    if (dto.lifeType !== undefined) {
      await this.prisma.physioCase.update({
        where: { id: caseId },
        data: { lifeType: dto.lifeType as any },
      });
    }

    const data: any = {
      smokes: dto.smokes ?? false,
      hasSmokedBefore: dto.hasSmokedBefore ?? false,
      smokingFrequency: dto.smokingFrequency,
      hasPacemaker: dto.hasPacemaker ?? false,
      pacemakerDetail: dto.hasPacemaker === false ? null : dto.pacemakerDetail,
      allergies: dto.allergies,
      adhesiveAllergy: dto.adhesiveAllergy ?? false,
      adhesiveAllergyDetail: dto.adhesiveAllergy === false ? null : dto.adhesiveAllergyDetail,
      currentMedications: dto.currentMedications,
      prescriptionDrugs: dto.prescriptionDrugs ?? false,
      herbalSupplements: dto.herbalSupplements ?? false,
      supplementsList: dto.supplementsList,
      isPregnant: dto.isPregnant ?? false,
      maritalStatus: dto.maritalStatus,
      lastMenstrualPeriod: dto.lastMenstrualPeriod,
      previousDiagnoses: dto.previousDiagnoses,
      chronicConditions: (dto.chronicConditions ?? []) as any,
      otherConditions: dto.otherConditions,
      chronicConditionsOther: dto.chronicConditionsOther,
      hasOtherHealthProblems: dto.hasOtherHealthProblems ?? false,
      hasDoctorRestrictions: dto.hasDoctorRestrictions ?? false,
      doctorRestrictions: dto.hasDoctorRestrictions === false ? null : dto.doctorRestrictions,
      previousComplaintsSurgeries: dto.previousComplaintsSurgeries,
      hadSurgeries: dto.hadSurgeries ?? false,
      surgeriesDetail: dto.hadSurgeries === false ? null : dto.surgeriesDetail,
      hadPTSameProblem: dto.hadPTSameProblem ?? false,
      ptSameProblemDetail: dto.hadPTSameProblem === false ? null : dto.ptSameProblemDetail,
      receivingOtherTreatment: dto.receivingOtherTreatment ?? false,
      otherTreatmentDetail: dto.receivingOtherTreatment === false ? null : dto.otherTreatmentDetail,
      testsHad: (dto.testsHad ?? []) as any,
      testsOther: dto.testsOther,
      testResults: dto.testResults,
      newAnalysis: dto.newAnalysis,
      newAnalysisDate: dto.newAnalysisDate,
      newAnalysisAttachment: dto.newAnalysisAttachment,
      oldAnalysis: dto.oldAnalysis,
      oldAnalysisDate: dto.oldAnalysisDate,
      oldAnalysisAttachment: dto.oldAnalysisAttachment,
      boneDensityTest: dto.boneDensityTest ?? false,
      boneDensityDetail: dto.boneDensityTest === false ? null : dto.boneDensityDetail,
      hospitalizedLastYear: dto.hospitalizedLastYear ?? false,
      hospitalizedDetail: dto.hospitalizedLastYear === false ? null : dto.hospitalizedDetail,
      diagnosis: dto.diagnosis,
      imagingProcedures: dto.imagingProcedures !== undefined ? (dto.imagingProcedures as any) : undefined,
    };
    return this.prisma.medicalHistory.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
      include: { surgeries: true },
    });
  }

  // ── الملاحظات والتقييم (Notes & Evaluation) ─────────────────────────────────

  async upsertEvaluation(caseId: string, dto: EvaluationDto) {
    await this.findCaseOrThrow(caseId);
    // مخزّنة على الحالة نفسها (مثل الشكوى) — مربوطة بالمريض عبر حالته
    const updated = await this.prisma.physioCase.update({
      where: { id: caseId },
      data: {
        evalModalities: (dto.modalities ?? []) as any,
        evalOtherModality: dto.otherModality,
        evalNotes: dto.notes,
        evalSummary: dto.evaluation,
      },
    });
    return {
      caseId,
      modalities: updated.evalModalities,
      otherModality: updated.evalOtherModality,
      notes: updated.evalNotes,
      evaluation: updated.evalSummary,
    };
  }

  async addSurgery(caseId: string, dto: SurgeryDto) {
    await this.findCaseOrThrow(caseId);
    let history = await this.prisma.medicalHistory.findUnique({ where: { caseId } });
    if (!history) history = await this.prisma.medicalHistory.create({ data: { caseId } });
    return this.prisma.surgery.create({
      data: {
        historyId: history.id,
        name: dto.name,
        date: dto.date,
        type: dto.type,
        order: dto.order,
      },
    });
  }

  // ── Treatment Goals ───────────────────────────────────────────────────────

  async upsertTreatmentGoals(caseId: string, dto: TreatmentGoalsDto) {
    await this.findCaseOrThrow(caseId);
    const data: any = {
      goals: (dto.goals ?? []) as any,
      customGoal: dto.customGoal,
      decreasePain: dto.decreasePain ?? false,
      improveStrength: dto.improveStrength ?? false,
      lessDifficultyWork: dto.lessDifficultyWork ?? false,
      standLonger: dto.standLonger,
      sleepLonger: dto.sleepLonger,
      sitLonger: dto.sitLonger,
      improveMovement: dto.improveMovement ?? false,
      otherGoals: dto.otherGoals,
    };
    return this.prisma.treatmentGoals.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
  }

  // ── Postural Assessment ───────────────────────────────────────────────────

  async upsertPosturalAssessment(caseId: string, dto: PosturalAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const data: any = {
      seatedPosition: dto.seatedPosition,
      trunkControl: dto.trunkControl,
      head: dto.head ?? {},
      shoulders: dto.shoulders ?? {},
      elbow: dto.elbow ?? {},
      ribCage: dto.ribCage ?? {},
      spine: dto.spine ?? {},
      pelvis: dto.pelvis ?? {},
      hips: dto.hips ?? {},
      knees: dto.knees ?? {},
      feet: dto.feet ?? {},
      spasticityNotes: dto.spasticityNotes,
      generalNotes: dto.generalNotes,
      diagnosis: dto.diagnosis,
    };
    return this.prisma.posturalAssessment.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
  }

  // ── Treatment Plan ────────────────────────────────────────────────────────

  async upsertTreatmentPlan(caseId: string, dto: TreatmentPlanDto) {
    await this.findCaseOrThrow(caseId);

    // حقول رأس الفورم مخزّنة على الحالة — نحدّث المُرسل فقط (لا نمسح القيم الحالية)
    const caseData: any = {
      treatmentFrom: dto.treatmentFrom,
      treatmentTo: dto.treatmentTo,
      anticipatedVisits: dto.anticipatedVisits,
      physiotherapistId: dto.physiotherapistId,
      caseManagerId: dto.caseManagerId,
    };
    // اختيار متعدد للأخصائيين — نخزّن القائمة ونضبط الأخصائي الأساسي = أول عنصر (للتوافق/الفلترة)
    if (dto.physiotherapistIds !== undefined) {
      caseData.physiotherapistIds = dto.physiotherapistIds;
      if (dto.physiotherapistId === undefined && dto.physiotherapistIds.length > 0) {
        caseData.physiotherapistId = dto.physiotherapistIds[0];
      }
    }
    Object.keys(caseData).forEach((k) => caseData[k] === undefined && delete caseData[k]);
    if (Object.keys(caseData).length > 0) {
      await this.prisma.physioCase.update({ where: { id: caseId }, data: caseData });
    }

    // تحديث الخطة — المُرسل فقط (حتى لا يُمحى ما لم يُرسل، مثل modalities عند حفظ الرأس وحده)
    const planUpdate: any = {};
    if (dto.modalities !== undefined) planUpdate.modalities = dto.modalities as any;
    if (dto.otherModality !== undefined) planUpdate.otherModality = dto.otherModality;
    if (dto.remarks !== undefined) planUpdate.remarks = dto.remarks;
    if (dto.observation !== undefined) planUpdate.observation = dto.observation;
    if (dto.status !== undefined) planUpdate.status = dto.status as any;

    return this.prisma.physioTreatmentPlan.upsert({
      where: { caseId },
      create: {
        caseId,
        modalities: (dto.modalities ?? []) as any,
        otherModality: dto.otherModality,
        remarks: dto.remarks,
        observation: dto.observation,
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
      },
      update: planUpdate,
    });
  }

  async supervisorReview(caseId: string, dto: SupervisorReviewDto, userId: string) {
    const c = await this.findCaseOrThrow(caseId);
    const plan = await this.prisma.physioTreatmentPlan.findUnique({ where: { caseId } });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    // خزّن رأي رئيس القسم — وانقل الحالة ACTIVE_TREATMENT → SUPERVISOR_REVIEW (بعد الجلسات)
    const [updatedPlan] = await this.prisma.$transaction([
      this.prisma.physioTreatmentPlan.update({
        where: { caseId },
        data: {
          supervisorGaze: dto.supervisorGaze,
          supervisorId: userId,
          supervisorReviewedAt: new Date(),
        },
      }),
      this.prisma.physioCase.update({
        where: { id: caseId },
        data: c.status === 'ACTIVE_TREATMENT' ? { status: 'SUPERVISOR_REVIEW' as any } : {},
      }),
    ]);
    return updatedPlan;
  }

  // رأي الطبيب — بعد رأي رئيس القسم (بدون توقيع)
  async doctorReview(caseId: string, dto: DoctorReviewDto, userId: string) {
    const c = await this.findCaseOrThrow(caseId);
    const plan = await this.prisma.physioTreatmentPlan.findUnique({ where: { caseId } });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    // خزّن رأي الطبيب — وانقل الحالة SUPERVISOR_REVIEW → DOCTOR_REVIEW
    const [updatedPlan] = await this.prisma.$transaction([
      this.prisma.physioTreatmentPlan.update({
        where: { caseId },
        data: {
          doctorGaze: dto.doctorGaze,
          doctorId: userId,
          doctorReviewedAt: new Date(),
        },
      }),
      this.prisma.physioCase.update({
        where: { id: caseId },
        data: c.status === 'SUPERVISOR_REVIEW' ? { status: 'DOCTOR_REVIEW' as any } : {},
      }),
    ]);
    return updatedPlan;
  }

  async planSign(caseId: string, dto: PlanSignDto, userId: string, ip?: string) {
    const c = await this.findCaseOrThrow(caseId);
    const plan = await this.prisma.physioTreatmentPlan.findUnique({ where: { caseId } });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    // B6.1: منع الاستبدال — لا توقيع فوق توقيع قائم
    if (plan.doctorSignatureBase64) {
      throw new ConflictException({ code: 'ALREADY_SIGNED', message: 'Treatment plan is already signed' });
    }

    // B6.2: تحقق الهوية — الموقّع يجب أن يكون الطبيب المُشرف المعيّن للحالة
    if (c.supervisingDoctorId && c.supervisingDoctorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_ASSIGNED_SIGNER', message: 'Only the assigned supervising doctor may sign' });
    }

    // B6.3: ثبّت التوقيع مع IP وختم زمني، وانقل الحالة SUPERVISOR_REVIEW → DOCTOR_SIGN
    const [updatedPlan] = await this.prisma.$transaction([
      this.prisma.physioTreatmentPlan.update({
        where: { caseId },
        data: {
          doctorSignatureBase64: dto.signatureBase64,
          doctorId: userId,
          doctorReviewedAt: new Date(),
          doctorSignedAt: new Date(),
          doctorSignatureIp: ip ?? null,
          doctorGaze: dto.doctorGaze,
        },
      }),
      this.prisma.physioCase.update({
        where: { id: caseId },
        data: c.status === 'SUPERVISOR_REVIEW' ? { status: 'DOCTOR_SIGN' as any } : {},
      }),
    ]);
    return updatedPlan;
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  async addSession(caseId: string, dto: PhysioSessionDto) {
    const physioCase = await this.findCaseOrThrow(caseId);
    // رقم الجلسة تلقائي تسلسلي لكل حالة (داخل transaction لمنع التكرار عند التزامن)
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.physioSession.findFirst({
        where: { caseId },
        orderBy: { sessionNumber: 'desc' },
        select: { sessionNumber: true },
      });
      // الجلسات تُنشأ دائماً بدون قيود (غير مربوطة بمراحل الحالة ولا بالجلسة السابقة)
      const sessionNumber = (last?.sessionNumber ?? 0) + 1;
      return tx.physioSession.create({
        data: {
          caseId,
          sessionNumber,
          sessionDate: new Date(dto.sessionDate),
          sessionTime: dto.sessionTime,
          notes: dto.notes,
          supervisorOpinion: dto.supervisorOpinion,
          doctorDecision: dto.doctorDecision,
          // يُعبّأ تلقائياً من أخصائي الحالة (لم يعد يُرسل من الفرونت)
          physiotherapistId: physioCase.physiotherapistId ?? null,
        },
      });
    });
  }

  async getSessions(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.physioSession.findMany({
      where: { caseId },
      orderBy: { sessionNumber: 'asc' },
    });
  }

  async updateSession(caseId: string, sessionId: string, dto: UpdateSessionDto) {
    await this.findCaseOrThrow(caseId);
    const session = await this.prisma.physioSession.findFirst({ where: { id: sessionId, caseId } });
    if (!session) throw new NotFoundException('Session not found');
    return this.prisma.physioSession.update({
      where: { id: sessionId },
      data: {
        ...(dto.sessionDate !== undefined ? { sessionDate: new Date(dto.sessionDate) } : {}),
        ...(dto.sessionTime !== undefined ? { sessionTime: dto.sessionTime } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.supervisorOpinion !== undefined ? { supervisorOpinion: dto.supervisorOpinion } : {}),
        ...(dto.doctorDecision !== undefined ? { doctorDecision: dto.doctorDecision } : {}),
      },
    });
  }

  // ── الملخص النهائي (Final Summary) ──────────────────────────────────────────

  async upsertFinalSummary(caseId: string, dto: FinalSummaryDto) {
    await this.findCaseOrThrow(caseId);
    const updated = await this.prisma.physioCase.update({
      where: { id: caseId },
      data: { finalSummary: dto.finalSummary },
    });
    return { caseId, finalSummary: updated.finalSummary };
  }

  async deleteSession(caseId: string, sessionId: string) {
    await this.findCaseOrThrow(caseId);
    const session = await this.prisma.physioSession.findFirst({ where: { id: sessionId, caseId } });
    if (!session) throw new NotFoundException('Session not found');
    return this.prisma.physioSession.delete({ where: { id: sessionId } });
  }

  // ── Convert Doctor Exam → Physio ─────────────────────────────────────────

  async convertToPhysio(examCaseId: string, userId: string) {
    const examCase = await this.findCaseOrThrow(examCaseId);
    if ((examCase as any).caseType !== 'DOCTOR_EXAM') {
      throw new BadRequestException('الحالة ليست معاينة طبيب');
    }

    // idempotent: لو سبق التحويل، نرجع الحالة الموجودة مباشرة
    if ((examCase as any).convertedToCaseId) {
      const existing = await this.prisma.physioCase.findFirst({
        where: { id: (examCase as any).convertedToCaseId },
        select: { id: true, caseNumber: true },
      });
      if (existing) {
        return { convertedCaseId: existing.id, caseNumber: existing.caseNumber };
      }
    }

    // جلب خريطة الألم والتاريخ الطبي من حالة المعاينة
    const [painMap, medHistory] = await Promise.all([
      this.prisma.painMap.findUnique({ where: { caseId: examCaseId } }),
      this.prisma.medicalHistory.findUnique({ where: { caseId: examCaseId } }),
    ]);

    return this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', year + 1000);

      const last = await tx.physioCase.findFirst({
        where: { caseNumber: { startsWith: `PT-${year}-` } },
        orderBy: { caseNumber: 'desc' },
        select: { caseNumber: true },
      });
      const lastSeq = last ? parseInt(last.caseNumber.split('-')[2], 10) : 0;
      const caseNumber = `PT-${year}-${String(lastSeq + 1).padStart(4, '0')}`;

      // إنشاء حالة physio جديدة بنفس بيانات المعاينة
      const newCase = await tx.physioCase.create({
        data: {
          caseNumber,
          caseType: 'PHYSIO' as any,
          patientId: examCase.patientId,
          majorComplaint: examCase.majorComplaint,
          symptoms: examCase.symptoms,
          currentJob: examCase.currentJob ?? undefined,
          lifeType: examCase.lifeType ?? undefined,
          complaintStartDate: examCase.complaintStartDate ?? undefined,
          possibleCause: examCase.possibleCause ?? undefined,
          previousDoctorSeen: examCase.previousDoctorSeen ?? undefined,
          previousTreatment: examCase.previousTreatment ?? undefined,
          hadPreviousPT: examCase.hadPreviousPT,
          hadPreviousInjury: examCase.hadPreviousInjury ?? undefined,
          complaintType: examCase.complaintType ?? undefined,
          painLocation: examCase.painLocation ?? undefined,
          complaintDuration: examCase.complaintDuration ?? undefined,
          complaintNotes: examCase.complaintNotes ?? undefined,
          hasChronicDiseases: examCase.hasChronicDiseases,
          visitedSpecialist: examCase.visitedSpecialist,
          hadSurgery: examCase.hadSurgery,
          painLevel: examCase.painLevel ?? undefined,
          painDuration: examCase.painDuration ?? undefined,
          painProgression: examCase.painProgression ?? undefined,
          bestTimeOfDay: examCase.bestTimeOfDay ?? undefined,
          worstTimeOfDay: examCase.worstTimeOfDay ?? undefined,
          painTypes: examCase.painTypes as any,
          aggravatingFactors: examCase.aggravatingFactors as any,
          alleviatingFactors: examCase.alleviatingFactors as any,
          customPainTypes: examCase.customPainTypes as any,
          createdBy: userId,
        },
      });

      // نسخ خريطة الألم إن وُجدت
      if (painMap) {
        await tx.painMap.create({
          data: {
            caseId: newCase.id,
            regions: painMap.regions as any,
            notes: painMap.notes ?? undefined,
          },
        });
      }

      // نسخ التاريخ الطبي إن وُجد (بدون العمليات الجراحية للتبسيط)
      if (medHistory) {
        await tx.medicalHistory.create({
          data: {
            caseId: newCase.id,
            smokes: medHistory.smokes,
            hasSmokedBefore: medHistory.hasSmokedBefore,
            smokingFrequency: medHistory.smokingFrequency ?? undefined,
            hasPacemaker: medHistory.hasPacemaker,
            pacemakerDetail: medHistory.pacemakerDetail ?? undefined,
            allergies: medHistory.allergies ?? undefined,
            adhesiveAllergy: medHistory.adhesiveAllergy,
            adhesiveAllergyDetail: medHistory.adhesiveAllergyDetail ?? undefined,
            currentMedications: medHistory.currentMedications ?? undefined,
            prescriptionDrugs: medHistory.prescriptionDrugs,
            herbalSupplements: medHistory.herbalSupplements,
            supplementsList: medHistory.supplementsList ?? undefined,
            isPregnant: medHistory.isPregnant,
            maritalStatus: medHistory.maritalStatus ?? undefined,
            lastMenstrualPeriod: medHistory.lastMenstrualPeriod ?? undefined,
            previousDiagnoses: medHistory.previousDiagnoses ?? undefined,
            chronicConditions: medHistory.chronicConditions as any,
            otherConditions: medHistory.otherConditions ?? undefined,
            hasOtherHealthProblems: medHistory.hasOtherHealthProblems,
            hasDoctorRestrictions: medHistory.hasDoctorRestrictions,
            doctorRestrictions: medHistory.doctorRestrictions ?? undefined,
            hadSurgeries: medHistory.hadSurgeries,
            surgeriesDetail: medHistory.surgeriesDetail ?? undefined,
            hadPTSameProblem: medHistory.hadPTSameProblem,
            ptSameProblemDetail: medHistory.ptSameProblemDetail ?? undefined,
            receivingOtherTreatment: medHistory.receivingOtherTreatment,
            otherTreatmentDetail: medHistory.otherTreatmentDetail ?? undefined,
            testsHad: medHistory.testsHad as any,
            testsOther: medHistory.testsOther ?? undefined,
            testResults: medHistory.testResults ?? undefined,
            newAnalysis: medHistory.newAnalysis ?? undefined,
            newAnalysisDate: medHistory.newAnalysisDate ?? undefined,
            oldAnalysis: medHistory.oldAnalysis ?? undefined,
            oldAnalysisDate: medHistory.oldAnalysisDate ?? undefined,
            boneDensityTest: medHistory.boneDensityTest,
            boneDensityDetail: medHistory.boneDensityDetail ?? undefined,
            hospitalizedLastYear: medHistory.hospitalizedLastYear,
            hospitalizedDetail: medHistory.hospitalizedDetail ?? undefined,
            diagnosis: medHistory.diagnosis ?? undefined,
            imagingProcedures: medHistory.imagingProcedures ?? undefined,
          },
        });
      }

      // تحديث حالة المعاينة: COMPLETED + تخزين ID الحالة المُنشأة (idempotency)
      await tx.physioCase.update({
        where: { id: examCaseId },
        data: {
          status: 'COMPLETED' as any,
          convertedToCaseId: newCase.id,
          finalNotes: `تم التحويل إلى حالة علاج فيزيائي: ${newCase.caseNumber}`,
        },
      });

      return { convertedCaseId: newCase.id, caseNumber: newCase.caseNumber };
    });
  }

  // ── Follow-ups ────────────────────────────────────────────────────────────

  async addFollowUp(caseId: string, dto: PhysioFollowUpDto) {
    const physioCase = await this.findCaseOrThrow(caseId);
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.physioFollowUp.findFirst({
        where: { caseId },
        orderBy: { followUpNumber: 'desc' },
        select: { followUpNumber: true },
      });
      const followUpNumber = (last?.followUpNumber ?? 0) + 1;
      return tx.physioFollowUp.create({
        data: {
          caseId,
          followUpNumber,
          sessionDate: new Date(dto.sessionDate),
          sessionTime: dto.sessionTime,
          notes: dto.notes,
          supervisorOpinion: dto.supervisorOpinion,
          doctorDecision: dto.doctorDecision,
          physiotherapistId: physioCase.physiotherapistId ?? null,
        },
      });
    });
  }

  async getFollowUps(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.physioFollowUp.findMany({
      where: { caseId },
      orderBy: { followUpNumber: 'asc' },
    });
  }

  async updateFollowUp(caseId: string, followUpId: string, dto: UpdateFollowUpDto) {
    await this.findCaseOrThrow(caseId);
    const followUp = await this.prisma.physioFollowUp.findFirst({ where: { id: followUpId, caseId } });
    if (!followUp) throw new NotFoundException('Follow-up not found');
    return this.prisma.physioFollowUp.update({
      where: { id: followUpId },
      data: {
        ...(dto.sessionDate !== undefined ? { sessionDate: new Date(dto.sessionDate) } : {}),
        ...(dto.sessionTime !== undefined ? { sessionTime: dto.sessionTime } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.supervisorOpinion !== undefined ? { supervisorOpinion: dto.supervisorOpinion } : {}),
        ...(dto.doctorDecision !== undefined ? { doctorDecision: dto.doctorDecision } : {}),
      },
    });
  }

  async deleteFollowUp(caseId: string, followUpId: string) {
    await this.findCaseOrThrow(caseId);
    const followUp = await this.prisma.physioFollowUp.findFirst({ where: { id: followUpId, caseId } });
    if (!followUp) throw new NotFoundException('Follow-up not found');
    return this.prisma.physioFollowUp.delete({ where: { id: followUpId } });
  }

  // ── Timeline ──────────────────────────────────────────────────────────────

  async getTimeline(caseId: string) {
    const c = await this.prisma.physioCase.findFirst({
      where: { id: caseId, deletedAt: null },
      include: {
        treatmentPlan: { select: { supervisorReviewedAt: true, doctorReviewedAt: true } },
        sessions: {
          select: { sessionDate: true, painLevel: true, notes: true },
          orderBy: { sessionDate: 'asc' },
        },
      },
    });
    if (!c) throw new NotFoundException('Physio case not found');

    const events: Array<{ date: Date; type: string; title: string; description?: string }> = [];
    const add = (date: Date | null | undefined, type: string, title: string, description?: string) => {
      if (date) events.push({ date, type, title, description });
    };

    add(c.createdAt, 'case_created', 'تم إنشاء الملف');

    if (c.treatmentPlan) {
      add(c.treatmentPlan.supervisorReviewedAt, 'supervisor_review', 'مراجعة المشرف لخطة العلاج');
      add(c.treatmentPlan.doctorReviewedAt,     'plan_signed',       'توقيع الطبيب على خطة العلاج');
    }

    for (const s of c.sessions) {
      const desc = s.painLevel != null ? `مستوى الألم: ${s.painLevel}` : (s.notes ?? undefined);
      add(s.sessionDate, 'session', 'جلسة علاج طبيعي', desc);
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    return { caseId, caseNumber: c.caseNumber, timeline: events };
  }
}
