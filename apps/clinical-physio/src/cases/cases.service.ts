import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePhysioCaseDto, UpdatePhysioCaseDto, UpdatePhysioStatusDto, ListPhysioCasesQueryDto,
  PainMapDto, MedicalHistoryDto, SurgeryDto, TreatmentGoalsDto,
  PosturalAssessmentDto, TreatmentPlanDto, SupervisorReviewDto, PlanSignDto,
  PhysioSessionDto, UpdateSessionDto,
} from './dto/physio-case.dto';

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.physioCase.count();
    return `PT-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async findCaseOrThrow(id: string) {
    const c = await this.prisma.physioCase.findFirst({ where: { id, deletedAt: null } });
    if (!c) throw new NotFoundException('Physio case not found');
    return c;
  }

  // ── Cases CRUD ────────────────────────────────────────────────────────────

  async create(dto: CreatePhysioCaseDto, userId: string) {
    const caseNumber = await this.generateCaseNumber();
    return this.prisma.physioCase.create({
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
    await this.findCaseOrThrow(id);
    return this.prisma.physioCase.update({
      where: { id },
      data: { status: dto.status as any },
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
    await this.findCaseOrThrow(caseId);
    const plan = await this.prisma.physioTreatmentPlan.findUnique({ where: { caseId } });
    if (!plan) throw new NotFoundException('Treatment plan not found');
    return this.prisma.physioTreatmentPlan.update({
      where: { caseId },
      data: {
        supervisorGaze: dto.supervisorGaze,
        supervisorId: userId,
        supervisorReviewedAt: new Date(),
      },
    });
  }

  async planSign(caseId: string, dto: PlanSignDto, userId: string) {
    await this.findCaseOrThrow(caseId);
    let plan = await this.prisma.physioTreatmentPlan.findUnique({ where: { caseId } });
    if (!plan) throw new NotFoundException('Treatment plan not found');
    return this.prisma.physioTreatmentPlan.update({
      where: { caseId },
      data: {
        doctorSignatureBase64: dto.signatureBase64,
        doctorId: userId,
        doctorReviewedAt: new Date(),
        doctorGaze: dto.doctorGaze,
      },
    });
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
}
