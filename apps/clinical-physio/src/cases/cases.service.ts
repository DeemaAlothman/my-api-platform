import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePhysioCaseDto, UpdatePhysioCaseDto, UpdatePhysioStatusDto, ListPhysioCasesQueryDto,
  PainMapDto, MedicalHistoryDto, SurgeryDto, TreatmentGoalsDto,
  PosturalAssessmentDto, TreatmentPlanDto, SupervisorReviewDto, PlanSignDto,
  PhysioSessionDto, UpdateSessionDto,
} from './dto/physio-case.dto';

// B11: خريطة الانتقالات المسموحة لحالة الملف
const STATUS_TRANSITIONS: Record<string, string[]> = {
  INTAKE:              ['COMPLAINT', 'CANCELLED'],
  COMPLAINT:           ['PAIN_MAP', 'CANCELLED'],
  PAIN_MAP:            ['MEDICAL_HISTORY', 'CANCELLED'],
  MEDICAL_HISTORY:     ['GOALS', 'CANCELLED'],
  GOALS:               ['POSTURAL_ASSESSMENT', 'CANCELLED'],
  POSTURAL_ASSESSMENT: ['TREATMENT_PLAN', 'CANCELLED'],
  TREATMENT_PLAN:      ['SUPERVISOR_REVIEW', 'CANCELLED'],
  SUPERVISOR_REVIEW:   ['DOCTOR_SIGN', 'TREATMENT_PLAN', 'CANCELLED'],
  DOCTOR_SIGN:         ['ACTIVE_TREATMENT', 'CANCELLED'],
  ACTIVE_TREATMENT:    ['COMPLETED', 'CANCELLED'],
  COMPLETED:           ['DISCHARGED'],
  DISCHARGED:          [],
  CANCELLED:           [],
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

  // ── Cases CRUD ────────────────────────────────────────────────────────────

  async create(dto: CreatePhysioCaseDto, userId: string) {
    // B12: تأكد من وجود المريض قبل إنشاء الحالة
    await this.assertPatientExists(dto.patientId);

    // B15: توليد caseNumber آمن داخل transaction مع advisory lock يمنع التكرار عند التزامن
    return this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', year);

      const last = await tx.physioCase.findFirst({
        where: { caseNumber: { startsWith: `PT-${year}-` } },
        orderBy: { caseNumber: 'desc' },
        select: { caseNumber: true },
      });
      const lastSeq = last ? parseInt(last.caseNumber.split('-')[2], 10) : 0;
      const caseNumber = `PT-${year}-${String(lastSeq + 1).padStart(4, '0')}`;

      return tx.physioCase.create({
        data: {
          caseNumber,
          patientId: dto.patientId,
          majorComplaint: dto.majorComplaint,
          symptoms: dto.symptoms,
          currentJob: dto.currentJob,
          lifeType: dto.lifeType as any,
          complaintStartDate: dto.complaintStartDate ? new Date(dto.complaintStartDate) : undefined,
          possibleCause: dto.possibleCause,
          previousDoctorSeen: dto.previousDoctorSeen,
          previousTreatment: dto.previousTreatment,
          hadPreviousPT: dto.hadPreviousPT ?? false,
          hadPreviousInjury: dto.hadPreviousInjury ?? false,
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
          treatmentFrom: dto.treatmentFrom ? new Date(dto.treatmentFrom) : undefined,
          treatmentTo: dto.treatmentTo ? new Date(dto.treatmentTo) : undefined,
          anticipatedVisits: dto.anticipatedVisits,
          createdBy: userId,
        },
      });
    });
  }

  async findAll(query: ListPhysioCasesQueryDto) {
    const { page = 1, limit = 20, patientId, status, physiotherapistId } = query;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
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
    return { items, total, page, limit };
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
    return c;
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
        physiotherapistId: dto.physiotherapistId,
        supervisingDoctorId: dto.supervisingDoctorId,
        caseManagerId: dto.caseManagerId,
        treatmentFrom: dto.treatmentFrom ? new Date(dto.treatmentFrom) : undefined,
        treatmentTo: dto.treatmentTo ? new Date(dto.treatmentTo) : undefined,
        anticipatedVisits: dto.anticipatedVisits,
        finalNotes: dto.finalNotes,
      },
    });
  }

  async updateStatus(id: string, dto: UpdatePhysioStatusDto) {
    const current = await this.findCaseOrThrow(id);
    const from = current.status as string;
    const to = dto.status as string;

    // B11: تحقق أن الانتقال مسموح ضمن آلة الحالات
    const allowed = STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_TRANSITION',
        message: `Transition from ${from} to ${to} is not allowed`,
        details: [{ from, to, allowed }],
      });
    }

    // B11: الانتقال إلى ACTIVE_TREATMENT ممنوع بدون توقيع طبيب صالح
    if (to === 'ACTIVE_TREATMENT') {
      const plan = await this.prisma.physioTreatmentPlan.findUnique({ where: { caseId: id } });
      if (!plan?.doctorSignatureBase64) {
        throw new BadRequestException({
          code: 'DOCTOR_SIGNATURE_REQUIRED',
          message: 'Cannot start treatment without a valid doctor signature',
        });
      }
    }

    return this.prisma.physioCase.update({
      where: { id },
      data: { status: to as any },
    });
  }

  async findByPatient(patientId: string) {
    return this.prisma.physioCase.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        treatmentPlan: { select: { status: true } },
        _count: { select: { sessions: true } },
      },
    });
  }

  // ── Pain Map ──────────────────────────────────────────────────────────────

  async upsertPainMap(caseId: string, dto: PainMapDto) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.painMap.upsert({
      where: { caseId },
      create: { caseId, regions: dto.regions, notes: dto.notes },
      update: { regions: dto.regions, notes: dto.notes },
    });
  }

  // ── Medical History ───────────────────────────────────────────────────────

  async upsertMedicalHistory(caseId: string, dto: MedicalHistoryDto) {
    await this.findCaseOrThrow(caseId);
    const data: any = {
      smokes: dto.smokes ?? false,
      hasSmokedBefore: dto.hasSmokedBefore ?? false,
      smokingFrequency: dto.smokingFrequency,
      hasPacemaker: dto.hasPacemaker ?? false,
      allergies: dto.allergies,
      adhesiveAllergy: dto.adhesiveAllergy ?? false,
      currentMedications: dto.currentMedications,
      prescriptionDrugs: dto.prescriptionDrugs ?? false,
      herbalSupplements: dto.herbalSupplements ?? false,
      supplementsList: dto.supplementsList,
      isPregnant: dto.isPregnant ?? false,
      previousDiagnoses: dto.previousDiagnoses,
      chronicConditions: (dto.chronicConditions ?? []) as any,
      otherConditions: dto.otherConditions,
      doctorRestrictions: dto.doctorRestrictions,
      testsHad: (dto.testsHad ?? []) as any,
      testsOther: dto.testsOther,
      testResults: dto.testResults,
      newAnalysis: dto.newAnalysis,
      newAnalysisDate: dto.newAnalysisDate ? new Date(dto.newAnalysisDate) : undefined,
      oldAnalysis: dto.oldAnalysis,
      oldAnalysisDate: dto.oldAnalysisDate ? new Date(dto.oldAnalysisDate) : undefined,
      hospitalizedLastYear: dto.hospitalizedLastYear ?? false,
      receivingOtherTreatment: dto.receivingOtherTreatment ?? false,
    };
    return this.prisma.medicalHistory.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
      include: { surgeries: true },
    });
  }

  async addSurgery(caseId: string, dto: SurgeryDto) {
    await this.findCaseOrThrow(caseId);
    let history = await this.prisma.medicalHistory.findUnique({ where: { caseId } });
    if (!history) history = await this.prisma.medicalHistory.create({ data: { caseId } });
    return this.prisma.surgery.create({
      data: {
        historyId: history.id,
        name: dto.name,
        date: dto.date ? new Date(dto.date) : undefined,
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
      standLongerMinutes: dto.standLongerMinutes,
      sleepLongerMinutes: dto.sleepLongerMinutes,
      sitLongerMinutes: dto.sitLongerMinutes,
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
    const data: any = {
      modalities: (dto.modalities ?? []) as any,
      otherModality: dto.otherModality,
      remarks: dto.remarks,
      observation: dto.observation,
    };
    return this.prisma.physioTreatmentPlan.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
  }

  async supervisorReview(caseId: string, dto: SupervisorReviewDto, userId: string) {
    const c = await this.findCaseOrThrow(caseId);
    const plan = await this.prisma.physioTreatmentPlan.findUnique({ where: { caseId } });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    // B16: خزّن نظرة المشرف وانقل الحالة TREATMENT_PLAN → SUPERVISOR_REVIEW
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
        data: c.status === 'TREATMENT_PLAN' ? { status: 'SUPERVISOR_REVIEW' as any } : {},
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
    await this.findCaseOrThrow(caseId);
    return this.prisma.physioSession.create({
      data: {
        caseId,
        sessionDate: new Date(dto.sessionDate),
        sessionTime: dto.sessionTime,
        modalities: (dto.modalities ?? []) as any,
        notes: dto.notes,
        physiotherapistId: dto.physiotherapistId,
        painLevel: dto.painLevel,
        romMeasurements: dto.romMeasurements,
        attendanceConfirmed: dto.attendanceConfirmed ?? false,
        appointmentId: dto.appointmentId,
      },
    });
  }

  async getSessions(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.physioSession.findMany({
      where: { caseId },
      orderBy: { sessionDate: 'asc' },
    });
  }

  async updateSession(caseId: string, sessionId: string, dto: UpdateSessionDto) {
    await this.findCaseOrThrow(caseId);
    const session = await this.prisma.physioSession.findFirst({ where: { id: sessionId, caseId } });
    if (!session) throw new NotFoundException('Session not found');
    return this.prisma.physioSession.update({
      where: { id: sessionId },
      data: {
        notes: dto.notes,
        modalities: dto.modalities as any,
        painLevel: dto.painLevel,
        romMeasurements: dto.romMeasurements,
        attendanceConfirmed: dto.attendanceConfirmed,
      },
    });
  }

  async deleteSession(caseId: string, sessionId: string) {
    await this.findCaseOrThrow(caseId);
    const session = await this.prisma.physioSession.findFirst({ where: { id: sessionId, caseId } });
    if (!session) throw new NotFoundException('Session not found');
    return this.prisma.physioSession.delete({ where: { id: sessionId } });
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
