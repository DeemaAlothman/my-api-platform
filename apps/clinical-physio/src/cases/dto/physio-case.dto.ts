import {
  IsString, IsOptional, IsBoolean, IsEnum, IsDateString,
  IsInt, IsArray, IsObject, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum LifeType { PROFESSIONAL = 'PROFESSIONAL', NORMAL = 'NORMAL', SEDENTARY = 'SEDENTARY', ABNORMAL = 'ABNORMAL' }
export enum PainLevel { MILD = 'MILD', MODERATE = 'MODERATE', SEVERE = 'SEVERE', EXCRUCIATING = 'EXCRUCIATING' }
export enum PainDuration { INTERMITTENT = 'INTERMITTENT', CONSTANT = 'CONSTANT', WITH_CERTAIN_MOTIONS = 'WITH_CERTAIN_MOTIONS' }
export enum PhysioPainType { NUMBNESS = 'NUMBNESS', DULL_ACHE = 'DULL_ACHE', HOT_BURNING = 'HOT_BURNING', SHARP_STABBING = 'SHARP_STABBING', PINS = 'PINS', OTHER = 'OTHER' }
export enum PainFactor { SITTING = 'SITTING', HEAT = 'HEAT', COLD = 'COLD', COUGHING = 'COUGHING', WALKING = 'WALKING', EXERCISE = 'EXERCISE', LYING_DOWN = 'LYING_DOWN', OTHER = 'OTHER' }
export enum PhysioGoal { BACK_TO_SPORTS = 'BACK_TO_SPORTS', BACK_TO_WORK = 'BACK_TO_WORK', SIMPLE_WORKS = 'SIMPLE_WORKS', PAIN_RELIEF = 'PAIN_RELIEF', OTHER = 'OTHER' }
export enum MedicalTest { MRI = 'MRI', XRAY = 'XRAY', CT = 'CT', MYELOGRAM = 'MYELOGRAM', BONE_DENSITY = 'BONE_DENSITY', OTHER = 'OTHER' }
export enum TherapyModality {
  ESWT = 'ESWT', US = 'US', TENS = 'TENS', EMS = 'EMS', LASER = 'LASER', CPM = 'CPM',
  HOT_PACKS = 'HOT_PACKS', COLD_PACKS = 'COLD_PACKS', TRACTION = 'TRACTION', EXERCISES = 'EXERCISES',
  MANUAL_THERAPY = 'MANUAL_THERAPY', MASSAGE = 'MASSAGE', KINESIO_TAPING = 'KINESIO_TAPING',
  COMPRESSION = 'COMPRESSION', PARAFFIN = 'PARAFFIN', GRASTON = 'GRASTON', MET = 'MET',
  PNF = 'PNF', INFRARED = 'INFRARED', OTHER = 'OTHER',
}
export enum PhysioStatus {
  INTAKE = 'INTAKE', COMPLAINT = 'COMPLAINT', PAIN_MAP = 'PAIN_MAP',
  MEDICAL_HISTORY = 'MEDICAL_HISTORY', GOALS = 'GOALS', POSTURAL_ASSESSMENT = 'POSTURAL_ASSESSMENT',
  TREATMENT_PLAN = 'TREATMENT_PLAN', SUPERVISOR_REVIEW = 'SUPERVISOR_REVIEW',
  DOCTOR_SIGN = 'DOCTOR_SIGN', ACTIVE_TREATMENT = 'ACTIVE_TREATMENT',
  COMPLETED = 'COMPLETED', DISCHARGED = 'DISCHARGED', CANCELLED = 'CANCELLED',
}

export class CreatePhysioCaseDto {
  @IsString()
  patientId: string;

  @IsString()
  majorComplaint: string;

  @IsString()
  symptoms: string;

  @IsOptional() @IsString()
  currentJob?: string;

  @IsOptional() @IsEnum(LifeType)
  lifeType?: LifeType;

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

  @IsOptional() @IsEnum(PainLevel)
  painLevel?: PainLevel;

  @IsOptional() @IsEnum(PainDuration)
  painDuration?: PainDuration;

  @IsOptional() @IsString()
  painProgression?: string;

  @IsOptional() @IsString()
  bestTimeOfDay?: string;

  @IsOptional() @IsString()
  worstTimeOfDay?: string;

  @IsOptional() @IsArray() @IsEnum(PhysioPainType, { each: true })
  painTypes?: PhysioPainType[];

  @IsOptional() @IsArray() @IsEnum(PainFactor, { each: true })
  aggravatingFactors?: PainFactor[];

  @IsOptional() @IsString()
  aggravatingOther?: string;

  @IsOptional() @IsArray() @IsEnum(PainFactor, { each: true })
  alleviatingFactors?: PainFactor[];

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

  @IsOptional() @IsEnum(LifeType)
  lifeType?: LifeType;

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

  // هل سبق التعرض لهذه الإصابة؟ (Have you had this injury before?)
  @IsOptional() @IsBoolean()
  hadPreviousInjury?: boolean;

  // هل يتحسن الألم أم يزداد سوءاً؟ (Is your pain getting better or worse?)
  @IsOptional() @IsString()
  painProgression?: string;
}

export class UpdatePhysioStatusDto {
  @IsEnum(PhysioStatus)
  status: PhysioStatus;
}

export class ListPhysioCasesQueryDto {
  @IsOptional() @IsString()
  patientId?: string;

  @IsOptional() @IsEnum(PhysioStatus)
  status?: PhysioStatus;

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  limit?: number = 20;
}

// ── الشكوى المرضية (Medical Complaint) ──
export class ComplaintDto {
  // 1) نوع الشكاية المرضية
  @IsOptional() @IsString()
  complaintType?: string;

  // 2) تحديد مكان الألم
  @IsOptional() @IsString()
  painLocation?: string;

  // 3) منذ متى وأنت تعاني من الشكاية (نص حر)
  @IsOptional() @IsString()
  complaintDuration?: string;

  // 4) ملاحظات
  @IsOptional() @IsString()
  complaintNotes?: string;

  // 5) هل يوجد أمراض مزمنة؟ + التفصيل عند نعم
  @IsOptional() @IsBoolean()
  hasChronicDiseases?: boolean;
  @IsOptional() @IsString()
  chronicDiseasesDetail?: string;

  // 6) هل سبق وزرت طبيباً مختصاً؟ + السبب عند نعم (يُخزّن في previousDoctorSeen)
  @IsOptional() @IsBoolean()
  visitedSpecialist?: boolean;
  @IsOptional() @IsString()
  specialistReason?: string;

  // 7) هل خضعت لجلسات علاج فيزيائي سابقاً؟ + القيمة عند نعم (يُخزّن في previousTreatment)
  @IsOptional() @IsBoolean()
  hadPreviousPT?: boolean;
  @IsOptional() @IsString()
  previousPTDetail?: string;

  // 8) هل سبق وخضعت لعمل جراحي؟ + التفصيل عند نعم
  @IsOptional() @IsBoolean()
  hadSurgery?: boolean;
  @IsOptional() @IsString()
  surgeryDetail?: string;
}

export class PainMapDto {
  @IsOptional() @IsArray()
  regions?: any[];

  @IsOptional() @IsString()
  notes?: string;

  // أنواع الألم: NUMBNESS / DULL_ACHE / HOT_BURNING / SHARP_STABBING / PINS / OTHER
  @IsOptional() @IsArray() @IsEnum(PhysioPainType, { each: true })
  painTypes?: PhysioPainType[];
  @IsOptional() @IsString()
  painTypeOther?: string;

  // العوامل المحرّضة للألم
  @IsOptional() @IsArray() @IsEnum(PainFactor, { each: true })
  aggravatingFactors?: PainFactor[];
  @IsOptional() @IsString()
  aggravatingOther?: string;

  // العوامل المخفّفة للألم
  @IsOptional() @IsArray() @IsEnum(PainFactor, { each: true })
  alleviatingFactors?: PainFactor[];
  @IsOptional() @IsString()
  alleviatingOther?: string;
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

  @IsOptional() @IsArray() @IsEnum(MedicalTest, { each: true })
  testsHad?: MedicalTest[];

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
  @IsOptional() @IsArray() @IsEnum(PhysioGoal, { each: true })
  goals?: PhysioGoal[];

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
  @IsOptional() @IsArray() @IsEnum(TherapyModality, { each: true })
  modalities?: TherapyModality[];

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

  @IsOptional() @IsArray() @IsEnum(TherapyModality, { each: true })
  modalities?: TherapyModality[];

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

  @IsOptional() @IsString()
  appointmentId?: string;
}

export class UpdateSessionDto {
  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsArray() @IsEnum(TherapyModality, { each: true })
  modalities?: TherapyModality[];

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  painLevel?: number;

  @IsOptional() @IsObject()
  romMeasurements?: any;

  @IsOptional() @IsBoolean()
  attendanceConfirmed?: boolean;
}
