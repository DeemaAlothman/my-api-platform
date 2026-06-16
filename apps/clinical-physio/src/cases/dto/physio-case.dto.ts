import {
  IsString, IsOptional, IsBoolean, IsEnum, IsDateString,
  IsInt, IsArray, IsObject, Min, Max, ValidateNested,
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
  PNF = 'PNF', INFRARED = 'INFRARED', SIS = 'SIS', OTHER = 'OTHER',
}
export enum PhysioStatus {
  INTAKE = 'INTAKE', COMPLAINT = 'COMPLAINT', PAIN_MAP = 'PAIN_MAP',
  MEDICAL_HISTORY = 'MEDICAL_HISTORY', GOALS = 'GOALS', POSTURAL_ASSESSMENT = 'POSTURAL_ASSESSMENT',
  TREATMENT_PLAN = 'TREATMENT_PLAN', EVALUATION = 'EVALUATION', SUPERVISOR_REVIEW = 'SUPERVISOR_REVIEW',
  DOCTOR_SIGN = 'DOCTOR_SIGN', ACTIVE_TREATMENT = 'ACTIVE_TREATMENT',
  COMPLETED = 'COMPLETED', DISCHARGED = 'DISCHARGED', CANCELLED = 'CANCELLED',
}
// حالة خطة العلاج: نشط / غير نشط
export enum PlanStatus { ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE' }

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

  // تاريخ البدء — حقل نصّي عادي (يقبل أي نص)
  @IsOptional() @IsString()
  complaintStartDate?: string;

  @IsOptional() @IsString()
  possibleCause?: string;

  @IsOptional() @IsString()
  previousDoctorSeen?: string;

  @IsOptional() @IsString()
  previousTreatment?: string;

  @IsOptional() @IsBoolean()
  hadPreviousPT?: boolean;

  @IsOptional() @IsString()
  hadPreviousInjury?: string;

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

  // تاريخ البدء — حقل نصّي عادي
  @IsOptional() @IsString()
  complaintStartDate?: string;

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

  // هل سبق التعرض لهذه الإصابة؟ (نص حر — حقل عادي اختياري)
  @IsOptional() @IsString()
  hadPreviousInjury?: string;

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

// ── الملاحظات والتقييم (Notes & Evaluation) ──
export class EvaluationDto {
  // أنواع العلاج (كلها اختيارية): MANUAL_THERAPY, MASSAGE, KINESIO_TAPING, COMPRESSION,
  // PARAFFIN, GRASTON, MET, PNF, INFRARED, OTHER, ESWT, US, TENS, EMS, LASER, CPM,
  // HOT_PACKS, COLD_PACKS, TRACTION, EXERCISES
  @IsOptional() @IsArray() @IsEnum(TherapyModality, { each: true })
  modalities?: TherapyModality[];

  // النص عند اختيار "أخرى Other"
  @IsOptional() @IsString()
  otherModality?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  evaluation?: string;
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
  // 1) نمط الحياة (يُخزّن على الحالة نفسها)
  @IsOptional() @IsEnum(LifeType)
  lifeType?: LifeType;

  @IsOptional() @IsBoolean()
  smokes?: boolean;

  @IsOptional() @IsBoolean()
  hasSmokedBefore?: boolean;

  @IsOptional() @IsString()
  smokingFrequency?: string;

  @IsOptional() @IsBoolean()
  hasPacemaker?: boolean;
  // 5) تفاصيل جهاز تنظيم ضربات القلب عند نعم
  @IsOptional() @IsString()
  pacemakerDetail?: string;

  @IsOptional() @IsString()
  allergies?: string; // الحساسية (عام)

  @IsOptional() @IsBoolean()
  adhesiveAllergy?: boolean; // حساسية لاصق/لاتكس/نحل
  @IsOptional() @IsString()
  adhesiveAllergyDetail?: string; // التفصيل عند نعم

  @IsOptional() @IsString()
  currentMedications?: string;

  @IsOptional() @IsBoolean()
  prescriptionDrugs?: boolean;

  @IsOptional() @IsBoolean()
  herbalSupplements?: boolean;

  @IsOptional() @IsString()
  supplementsList?: string;

  // حقول خاصة بالإناث (الفرونت يعرضها فقط إذا المريض أنثى)
  @IsOptional() @IsBoolean()
  isPregnant?: boolean;
  @IsOptional() @IsString()
  maritalStatus?: string;        // عزباء / متزوجة
  @IsOptional() @IsString()
  lastMenstrualPeriod?: string;  // تاريخ آخر دورة شهرية

  @IsOptional() @IsString()
  previousDiagnoses?: string;

  @IsOptional() @IsArray()
  chronicConditions?: string[];

  @IsOptional() @IsString()
  otherConditions?: string;

  // النص عند اختيار "آخر Other" في قائمة الأمراض المزمنة
  @IsOptional() @IsString()
  chronicConditionsOther?: string;

  // 6) هل تعاني من مشاكل صحية أخرى؟ (التفصيل في otherConditions)
  @IsOptional() @IsBoolean()
  hasOtherHealthProblems?: boolean;

  @IsOptional() @IsString()
  doctorRestrictions?: string;

  // 10) الشكاوى السابقة / العمليات الجراحية السابقة
  @IsOptional() @IsString()
  previousComplaintsSurgeries?: string;

  // هل خضعت لأي عمليات جراحية؟ + التفصيل عند نعم
  @IsOptional() @IsBoolean()
  hadSurgeries?: boolean;
  @IsOptional() @IsString()
  surgeriesDetail?: string;

  // 11) هل خضعت للعلاج الطبيعي لنفس المشكلة؟ + التفصيل عند نعم
  @IsOptional() @IsBoolean()
  hadPTSameProblem?: boolean;
  @IsOptional() @IsString()
  ptSameProblemDetail?: string;

  // 12) هل تتلقى علاجات أخرى لهذه المشكلة حالياً؟ + التفصيل عند نعم
  @IsOptional() @IsBoolean()
  receivingOtherTreatment?: boolean;
  @IsOptional() @IsString()
  otherTreatmentDetail?: string;

  @IsOptional() @IsArray() @IsEnum(MedicalTest, { each: true })
  testsHad?: MedicalTest[];

  @IsOptional() @IsString()
  testsOther?: string;

  @IsOptional() @IsString()
  testResults?: string;

  // 13) التحاليل + مرفق لكل تحليل (رابط مستند مريض)
  @IsOptional() @IsString()
  newAnalysis?: string;
  @IsOptional() @IsDateString()
  newAnalysisDate?: string;
  @IsOptional() @IsString()
  newAnalysisAttachment?: string;

  @IsOptional() @IsString()
  oldAnalysis?: string;
  @IsOptional() @IsDateString()
  oldAnalysisDate?: string;
  @IsOptional() @IsString()
  oldAnalysisAttachment?: string;

  // 14) قياس كثافة العظم
  @IsOptional() @IsBoolean()
  boneDensityTest?: boolean;
  @IsOptional() @IsString()
  boneDensityDetail?: string;

  // 15) هل دخلت المستشفى خلال العام الماضي بسبب هذه الحالة؟ + التفصيل عند نعم
  @IsOptional() @IsBoolean()
  hospitalizedLastYear?: boolean;
  @IsOptional() @IsString()
  hospitalizedDetail?: string;
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

  // حقول وقت (ساعات:دقائق) — نص مثل "2:30"
  @IsOptional() @IsString()
  standLonger?: string;

  @IsOptional() @IsString()
  sleepLonger?: string;

  @IsOptional() @IsString()
  sitLonger?: string;

  @IsOptional() @IsBoolean()
  improveMovement?: boolean;

  @IsOptional() @IsString()
  otherGoals?: string;
}

// ── التقييم الوضعي (Postural Assessment) — خيارات حرفية مطابقة للورقة ──
// كل خيار boolean مستقل (multi-select). الجوانب L/R منفصلة. "other" نص حر.

// جهة يمين/يسار
class SideDto {
  @IsOptional() @IsBoolean() L?: boolean;
  @IsOptional() @IsBoolean() R?: boolean;
}

// الرأس Head
class HeadAssessmentDto {
  @IsOptional() @IsBoolean() neutral?: boolean;          // حيادي
  @IsOptional() @IsBoolean() hyperextended?: boolean;    // فرط البسط
  @IsOptional() @IsBoolean() fwdFlexed?: boolean;        // تقدم الرأس للأمام
  @IsOptional() @ValidateNested() @Type(() => SideDto) laterallyFlexed?: SideDto; // عطف جانبي (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) rotated?: SideDto; // دوران (L/R)
}

// الأكتاف Shoulders
class ShouldersAssessmentDto {
  @IsOptional() @IsBoolean() level?: boolean;            // متساوية
  @IsOptional() @ValidateNested() @Type(() => SideDto) elevated?: SideDto; // مرتفعة (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) sublaxed?: SideDto; // غير مستقرة (L/R)
}

// المرفق Elbow
class ElbowAssessmentDto {
  @IsOptional() @IsBoolean() hyperextended?: boolean;    // فرط البسط
  @IsOptional() @ValidateNested() @Type(() => SideDto) supination?: SideDto; // استلقاء (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) pronation?: SideDto;  // كب (L/R)
  @IsOptional() @IsBoolean() flexed?: boolean;           // بوضعية العطف
}

// القفص الصدري Rib cage
class RibCageAssessmentDto {
  @IsOptional() @IsBoolean() neutral?: boolean;          // حيادي
  @IsOptional() @ValidateNested() @Type(() => SideDto) elevated?: SideDto;   // مرتفع (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) rotatedFwd?: SideDto; // تم تدويره للأمام (L/R)
}

// العمود الفقري Spine
class SpineAssessmentDto {
  @IsOptional() @IsBoolean() neutral?: boolean;          // حيادي
  @IsOptional() @ValidateNested() @Type(() => SideDto) scoliosisApex?: SideDto; // الجنف/ذروة الانحناء (L/R)
  @IsOptional() @IsBoolean() kyphosis?: boolean;         // حداب
  @IsOptional() @IsBoolean() flatLumbar?: boolean;       // تسطح العمود القطني
  @IsOptional() @IsBoolean() normalLumbar?: boolean;     // المسافة القطنية الطبيعية
  @IsOptional() @IsBoolean() hyperLordotic?: boolean;    // فرط التقعر القطني
}

// الحوض Pelvis
class PelvisAssessmentDto {
  @IsOptional() @IsBoolean() neutral?: boolean;          // حيادي
  @IsOptional() @IsBoolean() rotatedFwd?: boolean;       // دوران للأمام
  @IsOptional() @IsBoolean() anteriorTilt?: boolean;     // إمالة أمامية
  @IsOptional() @IsBoolean() posteriorTilt?: boolean;    // إمالة خلفية
  @IsOptional() @ValidateNested() @Type(() => SideDto) oblique?: SideDto; // ميل جانبي (L/R)
  @IsOptional() @IsString() other?: string;              // آخر
}

// الورك Hip
class HipsAssessmentDto {
  @IsOptional() @ValidateNested() @Type(() => SideDto) abducted?: SideDto; // تبعيد (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) adducted?: SideDto; // تقريب (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) flexed?: SideDto;   // بوضعية العطف (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) extended?: SideDto; // بوضعية البسط (L/R)
}

// الركبتان Knees
class KneesAssessmentDto {
  @IsOptional() @ValidateNested() @Type(() => SideDto) flexedBeyond90?: SideDto;   // عطف أكثر من 90° (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) extendedBeyond90?: SideDto; // بسط أكثر من 90° (L/R)
}

// القدم Feet
class FeetAssessmentDto {
  @IsOptional() @ValidateNested() @Type(() => SideDto) pronateEvert?: SideDto;  // الكب/الانقلاب الخارجي (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) supinateInv?: SideDto;   // الاستلقاء/الانقلاب الداخلي (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) dorsiflexed?: SideDto;   // العطف الظهري (L/R)
  @IsOptional() @ValidateNested() @Type(() => SideDto) plantarflexed?: SideDto; // العطف الأخمصي (L/R)
  @IsOptional() @IsString() other?: string;              // آخر
}

export class PosturalAssessmentDto {
  @IsOptional() @IsString()
  seatedPosition?: string; // الوضعية الحالية للجلوس

  @IsOptional() @IsString()
  trunkControl?: string; // التحكم في التوازن/الجذع

  @IsOptional() @ValidateNested() @Type(() => HeadAssessmentDto)
  head?: HeadAssessmentDto;

  @IsOptional() @ValidateNested() @Type(() => ShouldersAssessmentDto)
  shoulders?: ShouldersAssessmentDto;

  @IsOptional() @ValidateNested() @Type(() => ElbowAssessmentDto)
  elbow?: ElbowAssessmentDto;

  @IsOptional() @ValidateNested() @Type(() => RibCageAssessmentDto)
  ribCage?: RibCageAssessmentDto;

  @IsOptional() @ValidateNested() @Type(() => SpineAssessmentDto)
  spine?: SpineAssessmentDto;

  @IsOptional() @ValidateNested() @Type(() => PelvisAssessmentDto)
  pelvis?: PelvisAssessmentDto;

  @IsOptional() @ValidateNested() @Type(() => HipsAssessmentDto)
  hips?: HipsAssessmentDto;

  @IsOptional() @ValidateNested() @Type(() => KneesAssessmentDto)
  knees?: KneesAssessmentDto;

  @IsOptional() @ValidateNested() @Type(() => FeetAssessmentDto)
  feet?: FeetAssessmentDto;

  @IsOptional() @IsString()
  spasticityNotes?: string; // التشنج/ردود الفعل/التوتر العضلي

  @IsOptional() @IsString()
  generalNotes?: string; // تعليقات

  @IsOptional() @IsString()
  diagnosis?: string; // تشخيص
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

  // حالة الخطة: نشط ACTIVE / غير نشط INACTIVE
  @IsOptional() @IsEnum(PlanStatus)
  status?: PlanStatus;

  // ── حقول رأس الفورم (Plan of Treatment) — مخزّنة على الحالة ──
  @IsOptional() @IsDateString()
  treatmentFrom?: string; // من From

  @IsOptional() @IsDateString()
  treatmentTo?: string; // إلى To

  @IsOptional() @IsInt() @Type(() => Number)
  anticipatedVisits?: number; // عدد الزيارات المتوقعة

  @IsOptional() @IsString()
  physiotherapistId?: string; // اسم أخصائي العلاج الطبيعي

  @IsOptional() @IsString()
  caseManagerId?: string; // مدير الحالة
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

// جلسة علاجية — الحقول المبسّطة فقط (رقم الجلسة تلقائي من الباك)
export class PhysioSessionDto {
  @IsDateString()
  sessionDate: string; // التاريخ

  @IsOptional() @IsString()
  sessionTime?: string; // الوقت

  @IsOptional() @IsString()
  notes?: string; // ملاحظة

  @IsOptional() @IsString()
  supervisorOpinion?: string; // رأي رئيس القسم

  @IsOptional() @IsString()
  doctorDecision?: string; // قرار الطبيب (بدون توقيع)
}

export class UpdateSessionDto {
  @IsOptional() @IsDateString()
  sessionDate?: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  supervisorOpinion?: string; // رأي رئيس القسم

  @IsOptional() @IsString()
  doctorDecision?: string; // قرار الطبيب (بدون توقيع)
}

// الملخص النهائي بعد انتهاء كل الجلسات
export class FinalSummaryDto {
  @IsOptional() @IsString()
  finalSummary?: string;
}
