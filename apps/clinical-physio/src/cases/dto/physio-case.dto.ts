import {
  IsString, IsOptional, IsBoolean, IsEnum, IsDateString,
  IsInt, IsArray, IsObject, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePhysioCaseDto {
  @IsString()
  patientId: string;

  @IsString()
  majorComplaint: string;

  @IsString()
  symptoms: string;

  @IsOptional() @IsString()
  currentJob?: string;

  @IsOptional() @IsString()
  lifeType?: string;

  @IsOptional() @IsDateString()
  complaintStartDate?: string;

  @IsOptional() @IsString()
  possibleCause?: string;

  @IsOptional() @IsString()
  previousDoctorSeen?: string;

  @IsOptional() @IsString()
  previousTreatment?: string;

  @IsOptional() @IsBoolean()
  hadPreviousPT?: boolean;

  @IsOptional() @IsBoolean()
  hadPreviousInjury?: boolean;

  @IsOptional() @IsDateString()
  painStartDate?: string;

  @IsOptional() @IsString()
  painLevel?: string;

  @IsOptional() @IsString()
  painDuration?: string;

  @IsOptional() @IsString()
  painProgression?: string;

  @IsOptional() @IsString()
  bestTimeOfDay?: string;

  @IsOptional() @IsString()
  worstTimeOfDay?: string;

  @IsOptional() @IsArray()
  painTypes?: string[];

  @IsOptional() @IsArray()
  aggravatingFactors?: string[];

  @IsOptional() @IsString()
  aggravatingOther?: string;

  @IsOptional() @IsArray()
  alleviatingFactors?: string[];

  @IsOptional() @IsString()
  alleviatingOther?: string;

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsOptional() @IsString()
  supervisingDoctorId?: string;

  @IsOptional() @IsString()
  caseManagerId?: string;

  @IsOptional() @IsDateString()
  treatmentFrom?: string;

  @IsOptional() @IsDateString()
  treatmentTo?: string;

  @IsOptional() @IsInt() @Type(() => Number)
  anticipatedVisits?: number;
}

export class UpdatePhysioCaseDto {
  @IsOptional() @IsString()
  currentJob?: string;

  @IsOptional() @IsString()
  lifeType?: string;

  @IsOptional() @IsString()
  majorComplaint?: string;

  @IsOptional() @IsString()
  symptoms?: string;

  @IsOptional() @IsString()
  possibleCause?: string;

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsOptional() @IsString()
  supervisingDoctorId?: string;

  @IsOptional() @IsString()
  caseManagerId?: string;

  @IsOptional() @IsDateString()
  treatmentFrom?: string;

  @IsOptional() @IsDateString()
  treatmentTo?: string;

  @IsOptional() @IsInt() @Type(() => Number)
  anticipatedVisits?: number;

  @IsOptional() @IsString()
  finalNotes?: string;
}

export class UpdatePhysioStatusDto {
  @IsString()
  status: string;
}

export class ListPhysioCasesQueryDto {
  @IsOptional() @IsString()
  patientId?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  limit?: number = 20;
}

export class PainMapDto {
  @IsArray()
  regions: any[];

  @IsOptional() @IsString()
  notes?: string;
}

export class MedicalHistoryDto {
  @IsOptional() @IsBoolean()
  smokes?: boolean;

  @IsOptional() @IsBoolean()
  hasSmokedBefore?: boolean;

  @IsOptional() @IsString()
  smokingFrequency?: string;

  @IsOptional() @IsBoolean()
  hasPacemaker?: boolean;

  @IsOptional() @IsString()
  allergies?: string;

  @IsOptional() @IsBoolean()
  adhesiveAllergy?: boolean;

  @IsOptional() @IsString()
  currentMedications?: string;

  @IsOptional() @IsBoolean()
  prescriptionDrugs?: boolean;

  @IsOptional() @IsBoolean()
  herbalSupplements?: boolean;

  @IsOptional() @IsString()
  supplementsList?: string;

  @IsOptional() @IsBoolean()
  isPregnant?: boolean;

  @IsOptional() @IsString()
  previousDiagnoses?: string;

  @IsOptional() @IsArray()
  chronicConditions?: string[];

  @IsOptional() @IsString()
  otherConditions?: string;

  @IsOptional() @IsString()
  doctorRestrictions?: string;

  @IsOptional() @IsArray()
  testsHad?: string[];

  @IsOptional() @IsString()
  testsOther?: string;

  @IsOptional() @IsString()
  testResults?: string;

  @IsOptional() @IsString()
  newAnalysis?: string;

  @IsOptional() @IsDateString()
  newAnalysisDate?: string;

  @IsOptional() @IsString()
  oldAnalysis?: string;

  @IsOptional() @IsDateString()
  oldAnalysisDate?: string;

  @IsOptional() @IsBoolean()
  hospitalizedLastYear?: boolean;

  @IsOptional() @IsBoolean()
  receivingOtherTreatment?: boolean;
}

export class SurgeryDto {
  @IsString()
  name: string;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  type?: string;

  @IsInt() @Type(() => Number)
  order: number;
}

export class TreatmentGoalsDto {
  @IsOptional() @IsArray()
  goals?: string[];

  @IsOptional() @IsString()
  customGoal?: string;

  @IsOptional() @IsBoolean()
  decreasePain?: boolean;

  @IsOptional() @IsBoolean()
  improveStrength?: boolean;

  @IsOptional() @IsBoolean()
  lessDifficultyWork?: boolean;

  @IsOptional() @IsInt() @Type(() => Number)
  standLongerMinutes?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  sleepLongerMinutes?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  sitLongerMinutes?: number;

  @IsOptional() @IsBoolean()
  improveMovement?: boolean;

  @IsOptional() @IsString()
  otherGoals?: string;
}

export class PosturalAssessmentDto {
  @IsOptional() @IsString()
  seatedPosition?: string;

  @IsOptional() @IsString()
  trunkControl?: string;

  @IsOptional() @IsObject()
  head?: any;

  @IsOptional() @IsObject()
  shoulders?: any;

  @IsOptional() @IsObject()
  elbow?: any;

  @IsOptional() @IsObject()
  ribCage?: any;

  @IsOptional() @IsObject()
  spine?: any;

  @IsOptional() @IsObject()
  pelvis?: any;

  @IsOptional() @IsObject()
  hips?: any;

  @IsOptional() @IsObject()
  knees?: any;

  @IsOptional() @IsObject()
  feet?: any;

  @IsOptional() @IsString()
  spasticityNotes?: string;

  @IsOptional() @IsString()
  generalNotes?: string;

  @IsOptional() @IsString()
  diagnosis?: string;
}

export class TreatmentPlanDto {
  @IsOptional() @IsArray()
  modalities?: string[];

  @IsOptional() @IsString()
  otherModality?: string;

  @IsOptional() @IsString()
  remarks?: string;

  @IsOptional() @IsString()
  observation?: string;
}

export class SupervisorReviewDto {
  @IsString()
  supervisorGaze: string;
}

export class PlanSignDto {
  @IsString()
  signatureBase64: string;

  @IsOptional() @IsString()
  doctorGaze?: string;
}

export class PhysioSessionDto {
  @IsDateString()
  sessionDate: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsOptional() @IsArray()
  modalities?: string[];

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  physiotherapistId: string;

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  painLevel?: number;

  @IsOptional() @IsObject()
  romMeasurements?: any;

  @IsOptional() @IsBoolean()
  attendanceConfirmed?: boolean;
}

export class UpdateSessionDto {
  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsArray()
  modalities?: string[];

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  painLevel?: number;

  @IsOptional() @IsObject()
  romMeasurements?: any;

  @IsOptional() @IsBoolean()
  attendanceConfirmed?: boolean;
}
