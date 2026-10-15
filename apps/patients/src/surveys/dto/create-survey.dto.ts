import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min, Max, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export enum SurveyDepartmentEnum { PROSTHETICS = 'PROSTHETICS', PODIATRY = 'PODIATRY', PHYSIO = 'PHYSIO' }
export enum GenderEnum { MALE = 'MALE', FEMALE = 'FEMALE' }
export enum SurveyAgeGroupEnum {
  UNDER_18 = 'UNDER_18', FROM_18_25 = 'FROM_18_25', FROM_26_30 = 'FROM_26_30',
  FROM_31_40 = 'FROM_31_40', FROM_41_50 = 'FROM_41_50', FROM_51_60 = 'FROM_51_60', OVER_60 = 'OVER_60',
}
export enum SurveyComplaintStageEnum {
  ASSESSMENT = 'ASSESSMENT', MEASUREMENT = 'MEASUREMENT', TRAINING_REHAB = 'TRAINING_REHAB',
  SOCKET_FITTING = 'SOCKET_FITTING', NONE = 'NONE',
}
export enum PodiatryServiceTypeEnum { ANALYSIS_ONLY = 'ANALYSIS_ONLY', ANALYSIS_AND_FITTING = 'ANALYSIS_AND_FITTING' }
export enum PodiatryNoFittingReasonEnum { TIMING = 'TIMING', PRICE = 'PRICE', OTHER = 'OTHER' }

export class CreateSurveyDto {
  @IsString() @IsNotEmpty()
  patientId: string;

  @IsEnum(SurveyDepartmentEnum)
  department: string;

  @IsString() @IsNotEmpty()
  customerName: string;

  @IsEnum(GenderEnum)
  gender: string;

  @IsEnum(SurveyAgeGroupEnum)
  ageGroup: string;

  // ── مشتركة بين الأقسام الثلاثة ──
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  staffExplanationRating?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  specialistCareRating?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  waitingAreaRating?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  waitingDurationRating?: number;

  @Type(() => Number) @IsInt() @Min(1) @Max(5)
  overallCompanyRating: number;

  // ── خاص بالأطراف الصناعية ──
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  measurementAccuracyRating?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  movementEaseRating?: number;

  @IsOptional() @IsEnum(SurveyComplaintStageEnum)
  complaintStage?: string;

  // ── خاص بطب الأقدام ──
  @IsOptional() @IsEnum(PodiatryServiceTypeEnum)
  podiatryServiceType?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  medicalRecommendationRating?: number;

  // إجباري فقط لما podiatryServiceType = ANALYSIS_ONLY، وما بينبعت مع التركيب
  @ValidateIf((o) => o.podiatryServiceType === PodiatryServiceTypeEnum.ANALYSIS_ONLY)
  @IsEnum(PodiatryNoFittingReasonEnum)
  noFittingReason?: string;

  // إجباري فقط لما podiatryServiceType = ANALYSIS_AND_FITTING، وما بينبعت مع تحليل فقط
  @ValidateIf((o) => o.podiatryServiceType === PodiatryServiceTypeEnum.ANALYSIS_AND_FITTING)
  @Type(() => Number) @IsInt() @Min(1) @Max(5)
  insoleComfortRating?: number;

  // ── خاص بالعلاج الفيزيائي ──
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  exerciseQualityRating?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  mobilityImprovementRating?: number;

  @IsOptional() @IsString()
  additionalNotes?: string;
}
