import {
  IsString, IsOptional, IsArray, IsInt, Min, Max,
  IsNumber, IsBoolean, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── إجراء تصويري ─────────────────────────────────────────────────────────────
export class ImagingProcedureDto {
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() description?: string;
}

// ─── جراحة واحدة ─────────────────────────────────────────────────────────────
export class SurgeryDto {
  @IsOptional() @IsString() surgeryName?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() date?: string;
}

// ─── الشكوى المرضية (نموذج الطبيب + الاستقبال) ───────────────────────────────
export class ComplaintDto {
  // نموذج الطبيب
  @IsOptional() @IsString()  mainComplaint?: string;
  @IsOptional() @IsString()  startDate?: string;
  @IsOptional() @IsString()  possibleCause?: string;
  @IsOptional() @IsString()  previousDoctor?: string;
  @IsOptional() @IsString()  previousTreatment?: string;
  @IsOptional() @IsString()  symptomsBetterTime?: string;
  @IsOptional() @IsString()  symptomsWorseTime?: string;
  // painType: INTERMITTENT | CONSTANT | WITH_CERTAIN_MOTIONS
  @IsOptional() @IsString()  painType?: string;
  // painLevel: MILD | MODERATE | SEVERE | EXCRUCIATING
  @IsOptional() @IsString()  painLevel?: string;
  // painTrend: BETTER | WORSE | SAME
  @IsOptional() @IsString()  painTrend?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) hadInjuryBefore?: boolean;

  // حقول الاستقبال
  @IsOptional() @IsString()  problemDescription?: string;
  @IsOptional() @IsString()  historyOfSymptoms?: string;
  @IsOptional() @IsArray()   @IsString({ each: true }) affectedSide?: string[];
  @IsOptional() @IsArray()   @IsString({ each: true }) footSymptoms?: string[];
  @IsOptional() @IsArray()   @IsString({ each: true }) visitTypes?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(10) @Type(() => Number) vasScore?: number;
  @IsOptional() @IsString()  occupation?: string;
  @IsOptional() @IsString()  activities?: string;
}

// ─── التاريخ الطبي الكامل ─────────────────────────────────────────────────────
export class MedicalHistoryDto {
  // الطول والوزن
  @IsOptional() @IsNumber() @Type(() => Number) height?: number;
  @IsOptional() @IsNumber() @Type(() => Number) weight?: number;

  // الأدوية والتشخيصات
  @IsOptional() @IsString()  currentMedications?: string;
  @IsOptional() @IsString()  previousDiagnoses?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) herbalPreparations?: boolean;
  @IsOptional() @IsString()  herbalPreparationsDetails?: string;
  @IsOptional() @IsString()  otherHealthProblems?: string;
  @IsOptional() @IsString()  doctorRestrictions?: string;

  // التدخين
  @IsOptional() @IsBoolean() @Type(() => Boolean) smoker?: boolean;
  @IsOptional() @IsBoolean() @Type(() => Boolean) everSmoked?: boolean;
  @IsOptional() @IsString()  smokingFrequency?: string;

  // مؤشرات صحية
  @IsOptional() @IsBoolean() @Type(() => Boolean) hasPacemaker?: boolean;
  @IsOptional() @IsBoolean() @Type(() => Boolean) isPregnant?: boolean;
  @IsOptional() @IsBoolean() @Type(() => Boolean) allergyToAdhesives?: boolean;

  // العمليات الجراحية [ { surgeryName, type, date } ] — حتى 5
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SurgeryDto)
  surgeries?: SurgeryDto[];

  // العلاج الفيزيائي
  @IsOptional() @IsBoolean() @Type(() => Boolean) hadPhysicalTherapy?: boolean;
  @IsOptional() @IsBoolean() @Type(() => Boolean) hasOtherTreatments?: boolean;

  // التصوير الشعاعي — القيم: MRI | X_RAY | CT | MYELOGRAM | OTHER
  @IsOptional() @IsArray() @IsString({ each: true }) radiographyTypes?: string[];
  @IsOptional() @IsString()  radiographyOther?: string;
  @IsOptional() @IsString()  radiographyResults?: string;

  // التشخيص
  @IsOptional() @IsString()  diagnosis?: string;

  // التصوير الإجرائي — مصفوفة { imageUrl, description }
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImagingProcedureDto)
  imagingProcedures?: ImagingProcedureDto[];

  // التحليلات
  @IsOptional() @IsBoolean() @Type(() => Boolean) hasNewAnalysis?: boolean;
  @IsOptional() @IsString()  newAnalysisDate?: string;
  @IsOptional() @IsString()  newAnalysisNotes?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) hasOldAnalysis?: boolean;
  @IsOptional() @IsString()  oldAnalysisDate?: string;
  @IsOptional() @IsString()  oldAnalysisNotes?: string;

  // كثافة العظام والاستشفاء
  @IsOptional() @IsBoolean() @Type(() => Boolean) boneDensityScan?: boolean;
  @IsOptional() @IsBoolean() @Type(() => Boolean) hospitalizedPastYear?: boolean;

  // قائمة الأمراض (متعدد الاختيار)
  // LIVER_PROBLEMS | PNEUMONIA | URINARY_INFECTION | DIABETES | HEMOPHILIA |
  // LUNG_ISSUES | STROKE | KIDNEY_PROBLEMS | ANEMIA | ASTHMA |
  // CHEMICAL_DEPENDENCY | EPILEPSY | HIGH_LOW_BP | HEART_PROBLEMS | DEPRESSION |
  // BONE_INFECTION | ARTERIOSCLEROSIS | TUBERCULOSIS | MUSCULOSKELETAL |
  // JOINT_BONE_INFECTION | EYE_INFECTION | CIRCULATION_PROBLEMS | ARTHRITIS |
  // CANCER | BLOOD_CLOTS | ANGINA | STD | MULTIPLE_SCLEROSIS | AIDS_HIV | OTHER
  @IsOptional() @IsArray() @IsString({ each: true }) medicalHistory?: string[];
  @IsOptional() @IsString() medicalHistoryOther?: string;
}
