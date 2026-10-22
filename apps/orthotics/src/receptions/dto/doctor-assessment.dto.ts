import { IsString, IsOptional, IsArray, IsBoolean, ArrayMaxSize, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

// تقييم طبيب العظمية — القصة المرضية والفحص السريري
export class DoctorAssessmentDto {
  // diagnosisTypes: POLIO | CEREBRAL_PALSY | SPINA_BIFIDA | FOOT_DROP | OTHER
  @IsOptional() @IsArray() @IsString({ each: true }) diagnosisTypes?: string[];
  // cerebralPalsyType: SPASTIC | HYPOTONIC | ATAXIC
  @IsOptional() @IsString() cerebralPalsyType?: string;
  @IsOptional() @IsString() footDropCause?: string;
  @IsOptional() @IsString() diagnosisOther?: string;
  @IsOptional() @IsString() injuryStartDate?: string;
  @IsOptional() @IsString() surgicalHistory?: string;
  @IsOptional() @IsString() familyHistory?: string;
  @IsOptional() @IsString() chiefComplaint?: string;

  // عدد المقومات (الأجهزة التقويمية) المطلوبة
  @IsOptional() @Type(() => Number) @IsInt() appliancesCount?: number;
  // affectedLimbType: UPPER | LOWER
  @IsOptional() @IsString() affectedLimbType?: string;
  // affectedSide: RIGHT | LEFT
  @IsOptional() @IsString() affectedSide?: string;
  // وصف اختياري عن الطرف السليم
  @IsOptional() @IsString() soundLimbDescription?: string;

  // muscleTone: NORMAL | SPASTIC | HYPOTONIC
  @IsOptional() @IsString() muscleTone?: string;
  @IsOptional() @IsString() spasticityLevel?: string;
  // sensation: INTACT | REDUCED | ABSENT
  @IsOptional() @IsString() sensation?: string;
  // thighMuscleStrength / legFootMuscleStrength: EXCELLENT | MODERATE | WEAK
  @IsOptional() @IsString() thighMuscleStrength?: string;
  @IsOptional() @IsString() legFootMuscleStrength?: string;
  // skinConditions: INTACT | PRESSURE_POINTS | EDEMA
  @IsOptional() @IsArray() @IsString({ each: true }) skinConditions?: string[];
  @IsOptional() @IsString() pressurePointsLocation?: string;

  // قصة الولادة / عوامل الخطورة
  @IsOptional() @IsString() birthHistory?: string;
  // الاستخدام السابق للأجهزة التقويمية
  @IsOptional() @IsBoolean() @Type(() => Boolean) previousOrthosisUse?: boolean;
  @IsOptional() @IsString() previousOrthosisDetails?: string;
  // التاريخ المرضي / الأدوية
  @IsOptional() @IsString() medicalHistory?: string;

  // الأهداف الوظيفية — حتى 3 أهداف نصية
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) functionalGoals?: string[];
  // dailyUseSettings: HOME | SCHOOL | SPORTS | OTHER
  @IsOptional() @IsArray() @IsString({ each: true }) dailyUseSettings?: string[];
  @IsOptional() @IsString() dailyUseOther?: string;

  // رأي طبيب العظمية النهائي
  @IsOptional() @IsString() doctorOpinion?: string;
}
