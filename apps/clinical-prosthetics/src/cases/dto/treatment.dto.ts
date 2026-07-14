import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsObject, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class AddComponentDto {
  // اختياري — إذا غير موجود، يبحث النظام تلقائياً عن صنف بهذا الكود بالمخزون
  @IsOptional() @IsString()
  inventoryItemId?: string;

  @IsString()
  partCode: string;

  @IsString()
  partName: string;

  @IsString()
  supplier: string;

  @IsString()
  sourceLocation: string;

  @IsOptional() @IsString()
  reason?: string;
}

export class GaitAnalysisDto {
  @IsOptional() @IsArray()
  suspensionSystem?: string[];

  @IsOptional() @IsString()
  socketBearing?: string;

  @IsOptional() @IsString()
  kneeJointType?: string;

  @IsOptional() @IsString()
  footType?: string;

  @IsOptional() @IsBoolean()
  socketPain?: boolean;

  @IsOptional() @IsBoolean()
  residualLimbPain?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  painIntensity?: number;

  @IsOptional() @IsString()
  alignmentCheck?: string;

  @IsOptional() @IsBoolean()
  hasRomLimitations?: boolean;

  @IsOptional() @IsBoolean()
  hasHipFlexionContracture?: boolean;

  @IsOptional() @IsBoolean()
  hasKneeFlexionContracture?: boolean;

  @IsOptional() @IsBoolean()
  weakHipAbductors?: boolean;

  @IsOptional() @IsBoolean()
  weakHipExtensors?: boolean;

  @IsOptional() @IsBoolean()
  weakTrunkMuscles?: boolean;

  @IsOptional() @IsString()
  otherWeakness?: string;

  @IsOptional() @IsString()
  trunkStability?: string;

  @IsOptional() @IsString()
  abdominalControl?: string;

  @IsOptional() @IsString()
  pelvicControl?: string;

  @IsOptional() @IsString()
  sittingBalance?: string;

  @IsOptional() @IsString()
  standingBalance?: string;

  @IsOptional() @IsString()
  assistiveDevice?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  speedMs?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  cadence?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stepLengthProsCm?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stepLengthSoundCm?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stancePercProsthetic?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stancePercSound?: number;

  @IsOptional() @IsString()
  symmetry?: string;

  @IsOptional() @IsObject()
  deviations?: any;

  @IsOptional() @IsString()
  mainProblem?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  examinerProsthetistId: string;

  @IsString()
  examinerPhysioId: string;
}

export class BalanceAssessmentDto {
  @IsObject()
  staticResults: any;

  @IsObject()
  dynamicResults: any;

  @IsObject()
  activityResults: any;

  @IsOptional() @IsBoolean()
  historyOfFalls?: boolean;

  @IsOptional() @IsBoolean()
  nearFalls?: boolean;

  @IsOptional() @IsBoolean()
  fearOfFalling?: boolean;

  @IsOptional() @IsString()
  fallRiskLevel?: string;

  @IsOptional() @IsString()
  overallBalanceLevel?: string;

  @IsOptional() @IsObject()
  exerciseProgram?: any;

  @IsOptional() @IsBoolean()
  homeExerciseProgram?: boolean;

  @IsOptional() @IsInt() @Type(() => Number)
  followUpWeeks?: number;

  @IsString()
  examinerPhysioId: string;

  @IsOptional() @IsString()
  committeeHeadId?: string;
}

export class TreatmentPlanDto {
  @IsOptional() @IsString()
  notes?: string;
}

export class WorkshopSessionDto {
  @IsDateString()
  sessionDate: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsString()
  providedService: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  technicianId: string;
}

export class PtSessionDto {
  @IsDateString()
  sessionDate: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsString()
  providedService: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  physiotherapistId: string;
}

export class MediaSessionDto {
  @IsDateString()
  sessionDate: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsString()
  providedService: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  supervisorId: string;
}

export class BalanceAssessmentFormDto {
  @IsOptional() @IsDateString()
  assessmentDate?: string;

  @IsOptional() @IsBoolean()
  previousProsthesis?: boolean;

  @IsOptional() @IsString()
  previousProsthesisNotes?: string;

  // NONE | CANE | CRUTCHES | WALKER
  @IsOptional() @IsString()
  assistiveDevice?: string;

  // [{key: string, result: 'INDEPENDENT'|'ASSISTED'|'UNABLE'}]
  @IsOptional() @IsObject()
  staticBalance?: any;

  // [{key: string, result: 'GOOD'|'FAIR'|'POOR'}]
  @IsOptional() @IsObject()
  dynamicTasks?: any;

  // [{key: string, result: 'INDEPENDENT'|'WITH_DIFFICULTY'|'UNABLE'}]
  @IsOptional() @IsObject()
  dynamicActivities?: any;

  @IsOptional() @IsBoolean()
  historyOfFalls?: boolean;

  @IsOptional() @IsBoolean()
  nearFalls?: boolean;

  @IsOptional() @IsBoolean()
  fearOfFalling?: boolean;

  // HIGH | MODERATE | LOW
  @IsOptional() @IsString()
  fallRiskLevel?: string;

  @IsOptional() @IsString()
  fallRiskNotes?: string;

  // GOOD | FAIR | POOR
  @IsOptional() @IsString()
  overallBalanceLevel?: string;

  @IsOptional() @IsArray()
  limitingFactors?: string[];

  @IsOptional() @IsString()
  limitingFactorsOtherNotes?: string;

  // [{exercise, position, dosage, support, notes}]
  @IsOptional() @IsObject()
  exerciseProgram?: any;

  @IsOptional() @IsArray()
  programProgression?: string[];

  @IsOptional() @IsInt() @Type(() => Number)
  followUpWeeks?: number;

  @IsOptional() @IsArray()
  expectedOutcomes?: string[];

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsOptional() @IsString()
  physiotherapistSignatureUrl?: string;

  @IsOptional() @IsString()
  committeeHeadId?: string;

  @IsOptional() @IsString()
  committeeHeadSignatureUrl?: string;

  @IsOptional() @IsDateString()
  followUpDate?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class ProstheticDeliveryFormDto {
  @IsOptional() @IsDateString()
  inspectionDate?: string;

  @IsOptional() @IsString()
  prosthetistId?: string;

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsOptional() @IsString()
  ceoId?: string;

  @IsOptional() @IsString()
  ceoSignatureUrl?: string;

  @IsOptional() @IsDateString()
  signatureDate?: string;

  @IsOptional() @IsString()
  medicalDirectorId?: string;

  @IsOptional() @IsString()
  medicalDirectorSignatureUrl?: string;

  @IsOptional() @IsDateString()
  medicalDirectorSignedAt?: string;
}

export class ProstheticDeliveryItemDto {
  @IsOptional() @IsString()
  deliveredProduct?: string;

  @IsOptional() @IsString()
  partCode?: string;

  @IsOptional() @IsInt() @Type(() => Number)
  quantity?: number;

  @IsOptional() @IsString()
  company?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsDateString()
  itemAddedDate?: string;
}

export class PatientReviewProgramDto {
  @IsOptional() @IsDateString()
  sessionDate?: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  technicianId?: string;

  @IsOptional() @IsString()
  sessionStartTime?: string;

  @IsOptional() @IsString()
  sessionEndTime?: string;

  @IsOptional() @IsString()
  signatureUrl?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class CaseTreatmentProgramDto {
  @IsOptional() @IsDateString()
  sessionDate?: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsOptional() @IsString()
  sessionStartTime?: string;

  @IsOptional() @IsString()
  sessionEndTime?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  technicianId?: string;

  @IsOptional() @IsString()
  technicianSignatureUrl?: string;

  @IsOptional() @IsString()
  managerSignatureUrl?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class PatientTreatmentProgramDto {
  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  sessionStartTime?: string;

  @IsOptional() @IsString()
  sessionEndTime?: string;

  @IsOptional() @IsString()
  technicianId?: string;

  @IsOptional() @IsString()
  technicianSignatureUrl?: string;

  @IsOptional() @IsString()
  managerSignatureUrl?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class GaitAnalysisFormDto {
  @IsOptional() @IsDateString()
  sessionDate?: string;

  @IsOptional() @IsArray()
  suspensionSystem?: string[];

  @IsOptional() @IsString()
  socketBearing?: string;

  @IsOptional() @IsString()
  kneeJointType?: string;

  @IsOptional() @IsString()
  footType?: string;

  @IsOptional() @IsArray()
  patientComplaints?: string[];

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  painIntensity?: number;

  @IsOptional() @IsString()
  alignmentCheck?: string;

  @IsOptional() @IsBoolean()
  hasRomLimitations?: boolean;

  @IsOptional() @IsBoolean()
  hasHipFlexionContracture?: boolean;

  @IsOptional() @IsBoolean()
  hasKneeFlexionContracture?: boolean;

  @IsOptional() @IsBoolean()
  weakHipAbductors?: boolean;

  @IsOptional() @IsBoolean()
  weakHipExtensors?: boolean;

  @IsOptional() @IsBoolean()
  weakTrunkMuscles?: boolean;

  @IsOptional() @IsString()
  otherWeakness?: string;

  @IsOptional() @IsString()
  trunkStability?: string;

  @IsOptional() @IsString()
  abdominalControl?: string;

  @IsOptional() @IsString()
  pelvicControl?: string;

  @IsOptional() @IsString()
  sittingBalance?: string;

  @IsOptional() @IsString()
  standingBalance?: string;

  @IsOptional() @IsString()
  assistiveDevice?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  speedMs?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  cadence?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stepLengthProsCm?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stepLengthSoundCm?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stancePercProsthetic?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stancePercSound?: number;

  @IsOptional() @IsString()
  symmetry?: string;

  @IsOptional() @IsObject()
  initialContact?: any;

  @IsOptional() @IsObject()
  loadingResponse?: any;

  @IsOptional() @IsObject()
  midStance?: any;

  @IsOptional() @IsObject()
  terminalStance?: any;

  @IsOptional() @IsObject()
  preSwing?: any;

  @IsOptional() @IsObject()
  swingPhase?: any;

  @IsOptional() @IsString()
  gaitNotes?: string;

  @IsOptional() @IsArray()
  prostheticIssues?: string[];

  @IsOptional() @IsString()
  mainProblem?: string;

  @IsOptional() @IsArray()
  likelyCauses?: string[];

  @IsOptional() @IsArray()
  recommendations?: string[];

  @IsOptional() @IsString()
  recommendationsNotes?: string;

  @IsOptional() @IsObject()
  rehabPlan?: any;

  @IsOptional() @IsString()
  rehabNotes?: string;

  @IsOptional() @IsString()
  mainProblemNotes?: string;

  @IsOptional() @IsString()
  patientComplaintsOtherNotes?: string;

  @IsOptional() @IsString()
  suspensionSystemOtherNotes?: string;

  @IsOptional() @IsString()
  prostheticIssuesOtherNotes?: string;

  @IsOptional() @IsString()
  likelyCausesOtherNotes?: string;

  @IsOptional() @IsString()
  examinerProsthetistId?: string;

  @IsOptional() @IsString()
  prosthetistSignatureUrl?: string;

  @IsOptional() @IsString()
  examinerPhysiotherapistId?: string;

  @IsOptional() @IsString()
  physiotherapistSignatureUrl?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class ConsumableDto {
  @IsString()
  inventoryItemId: string;

  @IsString()
  consumableName: string;

  @IsNumber() @Type(() => Number)
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  supervisorId: string;
}
