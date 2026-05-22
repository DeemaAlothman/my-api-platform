import {
  Injectable, NotFoundException, BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto, UpdateCaseDto, UpdateStatusDto, ListCasesQueryDto } from './dto/case.dto';
import { UpperLimbAssessmentDto, LowerLimbAssessmentDto } from './dto/assessment.dto';
import { CommitteeOpinionDto, CommitteeDecideDto, CommitteeSignDto } from './dto/committee.dto';
import {
  AddComponentDto, GaitAnalysisDto, BalanceAssessmentDto,
  TreatmentPlanDto, WorkshopSessionDto, PtSessionDto, MediaSessionDto, ConsumableDto,
} from './dto/treatment.dto';
import {
  FinalEvaluationDto, DirectorSignDto, DeliveryDto,
  PatientSignDto, ManagerSignDto, FollowUpDto, GaitSignDto,
} from './dto/delivery.dto';

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  private async callInventoryDeduct(inventoryItemId: string, caseId: string, userId: string) {
    const url = `${process.env.INVENTORY_SERVICE_URL || 'http://clinic-inventory:4014'}/api/v1/inventory/transactions/internal-deduct`;
    const token = process.env.INTERNAL_SERVICE_TOKEN || '';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': token,
        },
        body: JSON.stringify({ itemId: inventoryItemId, quantity: 1, caseId, reason: 'PROSTHETICS_COMPONENT', userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || 'Inventory deduction failed');
      }
    } catch (e: any) {
      throw new InternalServerErrorException(`Failed to deduct from inventory: ${e.message}`);
    }
  }

  // ── Cases CRUD ────────────────────────────────────────────────────────────

  async create(dto: CreateCaseDto, userId: string) {
    const caseNumber = await this.generateCaseNumber();
    return this.prisma.prostheticsCase.create({
      data: {
        caseNumber,
        patientId: dto.patientId,
        amputationDate: new Date(dto.amputationDate),
        amputationCause: dto.amputationCause,
        amputationCount: dto.amputationCount,
        amputationType: dto.amputationType as any,
        amputationSide: dto.amputationSide as any,
        amputationLevel: dto.amputationLevel as any,
        hasPreviousProsthesis: dto.hasPreviousProsthesis ?? false,
        previousProsthesisDetails: dto.previousProsthesisDetails,
        hasRevisionSurgery: dto.hasRevisionSurgery ?? false,
        revisionDetails: dto.revisionDetails,
        hasPhysicalTherapy: dto.hasPhysicalTherapy ?? false,
        hasChronicDiseases: dto.hasChronicDiseases ?? false,
        chronicDiseases: dto.chronicDiseases,
        prosthetistId: dto.prosthetistId,
        physiotherapistId: dto.physiotherapistId,
        supervisingDoctorId: dto.supervisingDoctorId,
        workshopSupervisorId: dto.workshopSupervisorId,
        prosthesisType: dto.prosthesisType as any,
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
    if (amputationType) where.amputationType = amputationType;
    if (prosthetistId) where.prosthetistId = prosthetistId;

    const [items, total] = await Promise.all([
      this.prisma.prostheticsCase.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          upperAssessment: { select: { id: true, examinedAt: true } },
          lowerAssessment: { select: { id: true, examinedAt: true } },
          committeeReview: { select: { id: true, finalDecision: true } },
        },
      }),
      this.prisma.prostheticsCase.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const c = await this.prisma.prostheticsCase.findFirst({
      where: { id, deletedAt: null },
      include: {
        upperAssessment: true,
        lowerAssessment: true,
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
    return c;
  }

  async update(id: string, dto: UpdateCaseDto) {
    await this.findCaseOrThrow(id);
    return this.prisma.prostheticsCase.update({
      where: { id },
      data: {
        amputationCause: dto.amputationCause,
        hasPreviousProsthesis: dto.hasPreviousProsthesis,
        previousProsthesisDetails: dto.previousProsthesisDetails,
        hasRevisionSurgery: dto.hasRevisionSurgery,
        revisionDetails: dto.revisionDetails,
        hasPhysicalTherapy: dto.hasPhysicalTherapy,
        hasChronicDiseases: dto.hasChronicDiseases,
        chronicDiseases: dto.chronicDiseases,
        prosthetistId: dto.prosthetistId,
        physiotherapistId: dto.physiotherapistId,
        supervisingDoctorId: dto.supervisingDoctorId,
        workshopSupervisorId: dto.workshopSupervisorId,
        prosthesisType: dto.prosthesisType as any,
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
    return this.prisma.prostheticsCase.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        committeeReview: { select: { finalDecision: true } },
        delivery: { select: { deliveryDate: true } },
      },
    });
  }

  // ── Assessments ───────────────────────────────────────────────────────────

  async upsertUpperAssessment(caseId: string, dto: UpperLimbAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.upperLimbAssessment.upsert({
      where: { caseId },
      create: {
        caseId,
        residualLimbLength: dto.residualLimbLength as any,
        residualLimbShape: dto.residualLimbShape as any,
        residualLimbPhotoUrl: dto.residualLimbPhotoUrl,
        painPresent: dto.painPresent ?? false,
        painArea: dto.painArea,
        painIntensity: dto.painIntensity,
        painTypes: (dto.painTypes ?? []) as any,
        phantomPainPresent: dto.phantomPainPresent ?? false,
        phantomPainIntensity: dto.phantomPainIntensity,
        neuromaPalpable: dto.neuromaPalpable,
        skinAppearance: (dto.skinAppearance ?? []) as any,
        skinColor: (dto.skinColor ?? []) as any,
        skinTemperature: dto.skinTemperature as any,
        scarCondition: (dto.scarCondition ?? []) as any,
        hasSkinGrafts: dto.hasSkinGrafts ?? false,
        graftArea: dto.graftArea,
        activityLevel: dto.activityLevel as any,
        usesCompressionBandage: dto.usesCompressionBandage,
        romData: dto.romData,
        canBalanceOneSide: dto.canBalanceOneSide,
        notes: dto.notes,
        examinerProsthetistId: dto.examinerProsthetistId,
        examinerPhysioId: dto.examinerPhysioId,
      },
      update: {
        residualLimbLength: dto.residualLimbLength as any,
        residualLimbShape: dto.residualLimbShape as any,
        residualLimbPhotoUrl: dto.residualLimbPhotoUrl,
        painPresent: dto.painPresent,
        painArea: dto.painArea,
        painIntensity: dto.painIntensity,
        painTypes: dto.painTypes as any,
        phantomPainPresent: dto.phantomPainPresent,
        phantomPainIntensity: dto.phantomPainIntensity,
        neuromaPalpable: dto.neuromaPalpable,
        skinAppearance: dto.skinAppearance as any,
        skinColor: dto.skinColor as any,
        skinTemperature: dto.skinTemperature as any,
        scarCondition: dto.scarCondition as any,
        hasSkinGrafts: dto.hasSkinGrafts,
        graftArea: dto.graftArea,
        activityLevel: dto.activityLevel as any,
        usesCompressionBandage: dto.usesCompressionBandage,
        romData: dto.romData,
        canBalanceOneSide: dto.canBalanceOneSide,
        notes: dto.notes,
        examinerProsthetistId: dto.examinerProsthetistId,
        examinerPhysioId: dto.examinerPhysioId,
      },
    });
  }

  async upsertLowerAssessment(caseId: string, dto: LowerLimbAssessmentDto) {
    await this.findCaseOrThrow(caseId);
    const data: any = {
      loadTolerance: dto.loadTolerance as any,
      weightBearingLevel: dto.weightBearingLevel as any,
      otherLimbCondition: dto.otherLimbCondition,
      usesAssistiveDevices: dto.usesAssistiveDevices ?? false,
      assistiveDeviceTypes: dto.assistiveDeviceTypes,
      canClimbStairs: dto.canClimbStairs,
      canBalanceOneSide: dto.canBalanceOneSide,
      residualLimbLength: dto.residualLimbLength as any,
      residualLimbShape: dto.residualLimbShape as any,
      residualLimbPhotoUrl: dto.residualLimbPhotoUrl,
      painPresent: dto.painPresent ?? false,
      painArea: dto.painArea,
      painIntensity: dto.painIntensity,
      painTypes: (dto.painTypes ?? []) as any,
      phantomPainPresent: dto.phantomPainPresent ?? false,
      phantomPainIntensity: dto.phantomPainIntensity,
      neuromaPalpable: dto.neuromaPalpable,
      skinAppearance: (dto.skinAppearance ?? []) as any,
      skinColor: (dto.skinColor ?? []) as any,
      skinTemperature: dto.skinTemperature as any,
      scarCondition: (dto.scarCondition ?? []) as any,
      hasSkinGrafts: dto.hasSkinGrafts ?? false,
      graftArea: dto.graftArea,
      activityLevel: dto.activityLevel as any,
      romData: dto.romData,
      notes: dto.notes,
      examinerProsthetistId: dto.examinerProsthetistId,
      examinerPhysioId: dto.examinerPhysioId,
    };
    return this.prisma.lowerLimbAssessment.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
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
    return this.prisma.committeeReview.upsert({
      where: { caseId },
      create: {
        caseId,
        doctorSignatureBase64: dto.signatureBase64,
        doctorSignedAt: new Date(),
        doctorSignatureIp: ip,
        doctorUserId: userId,
      },
      update: {
        doctorSignatureBase64: dto.signatureBase64,
        doctorSignedAt: new Date(),
        doctorSignatureIp: ip,
        doctorUserId: userId,
      },
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
    return { pending };
  }

  // ── Components ────────────────────────────────────────────────────────────

  async addComponent(caseId: string, dto: AddComponentDto, userId: string) {
    await this.findCaseOrThrow(caseId);
    await this.callInventoryDeduct(dto.inventoryItemId, caseId, userId);
    return this.prisma.prosthesisComponent.create({
      data: {
        caseId,
        inventoryItemId: dto.inventoryItemId,
        partCode: dto.partCode,
        partName: dto.partName,
        supplier: dto.supplier,
        sourceLocation: dto.sourceLocation as any,
        reason: dto.reason,
        addedBy: userId,
      },
    });
  }

  async getComponents(caseId: string) {
    await this.findCaseOrThrow(caseId);
    return this.prisma.prosthesisComponent.findMany({
      where: { caseId },
      orderBy: { addedAt: 'desc' },
    });
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
      physioOpinion: dto.physioOpinion,
      prosthetistOpinion: dto.prosthetistOpinion,
      prosthetistSupervisorOpinion: dto.prosthetistSupervisorOpinion,
      committeeHeadOpinion: dto.committeeHeadOpinion,
      expertOpinion: dto.expertOpinion,
      readyForDelivery: dto.readyForDelivery ?? false,
      needsFollowUp: dto.needsFollowUp ?? false,
      followUpPlan: dto.followUpPlan,
    };
    return this.prisma.finalEvaluation.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
  }

  async directorSign(caseId: string, dto: DirectorSignDto, userId: string, ip: string) {
    await this.findCaseOrThrow(caseId);
    const existing = await this.prisma.finalEvaluation.findUnique({ where: { caseId } });
    const data: any = {
      medicalDirectorSignatureBase64: dto.signatureBase64,
      medicalDirectorSignedAt: new Date(),
      medicalDirectorIp: ip,
      managerNotes: dto.managerNotes,
      patientFileComplete: dto.patientFileComplete,
      managerSignatureBase64: dto.signatureBase64,
      managerSignedAt: new Date(),
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
}
