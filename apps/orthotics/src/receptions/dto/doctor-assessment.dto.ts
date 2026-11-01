import {
  IsString, IsOptional, IsArray, IsBoolean, ArrayMaxSize, IsInt, IsIn, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const MUSCLE_TONE_REGIONS = ['THIGH', 'LEG', 'FOOT', 'WRIST', 'UPPER_ARM', 'FOREARM'];
export const MUSCLE_TONE_SIDES = ['RIGHT', 'LEFT'];
export const MUSCLE_TONE_VALUES = ['NORMAL', 'SPASTIC', 'HYPOTONIC'];

// سطر واحد من تفصيل المقوية العضلية: منطقة + جهة، والمقوية اختيارية
// لأن الجهة ممكن تنحفظ قبل ما الطبيب يختار المقوية.
export class MuscleToneDetailDto {
  @IsIn(MUSCLE_TONE_REGIONS, { message: 'منطقة غير صالحة' }) region!: string;
  @IsIn(MUSCLE_TONE_SIDES, { message: 'جهة غير صالحة' }) side!: string;
  @IsOptional() @IsIn(MUSCLE_TONE_VALUES, { message: 'قيمة مقوية غير صالحة' }) tone?: string;
  @IsOptional() @IsString() spasticityLevel?: string;
}

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

  // muscleTone: NORMAL | SPASTIC | HYPOTONIC — الحقلان القديمان، بلا تغيير
  @IsOptional() @IsString() muscleTone?: string;
  @IsOptional() @IsString() spasticityLevel?: string;
  // تفصيل المقوية لكل منطقة/جهة. المصفوفة تُرسَل كاملة وتستبدل القديمة،
  // و [] تمسح الكل. حذف الحقل من الطلب يتركه كما هو.
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MuscleToneDetailDto)
  muscleToneDetails?: MuscleToneDetailDto[];
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
