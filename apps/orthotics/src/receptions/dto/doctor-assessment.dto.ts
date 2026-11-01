import {
  IsString, IsOptional, IsArray, IsBoolean, ArrayMaxSize, IsInt, IsIn, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// مناطق وجهات الجسم — مشتركة بين تفصيل المقوية وتفصيل الإحساس
export const BODY_REGIONS = ['THIGH', 'LEG', 'FOOT', 'WRIST', 'UPPER_ARM', 'FOREARM'];
export const BODY_SIDES = ['RIGHT', 'LEFT'];
export const MUSCLE_TONE_VALUES = ['NORMAL', 'SPASTIC', 'HYPOTONIC'];
export const SENSATION_VALUES = ['INTACT', 'REDUCED', 'ABSENT'];

// سطر واحد من تفصيل المقوية العضلية: منطقة + جهة، والمقوية اختيارية
// لأن الجهة ممكن تنحفظ قبل ما الطبيب يختار المقوية.
export class MuscleToneDetailDto {
  @IsIn(BODY_REGIONS, { message: 'منطقة غير صالحة' }) region!: string;
  @IsIn(BODY_SIDES, { message: 'جهة غير صالحة' }) side!: string;
  @IsOptional() @IsIn(MUSCLE_TONE_VALUES, { message: 'قيمة مقوية غير صالحة' }) tone?: string;
  @IsOptional() @IsString() spasticityLevel?: string;
}

// سطر واحد من تفصيل الإحساس: منطقة + جهة، والإحساس اختياري
// لأن الجهة ممكن تنحفظ قبل ما الطبيب يختار قيمة الإحساس.
export class SensationDetailDto {
  @IsIn(BODY_REGIONS, { message: 'منطقة غير صالحة' }) region!: string;
  @IsIn(BODY_SIDES, { message: 'جهة غير صالحة' }) side!: string;
  @IsOptional() @IsIn(SENSATION_VALUES, { message: 'قيمة إحساس غير صالحة' }) sensation?: string;
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
  // sensation: INTACT | REDUCED | ABSENT — الحقل القديم، بلا تغيير
  @IsOptional() @IsString() sensation?: string;
  // تفصيل الإحساس لكل منطقة/جهة. نفس قواعد muscleToneDetails:
  // المصفوفة تُرسَل كاملة وتستبدل القديمة، و [] تمسح الكل، وحذف الحقل يتركه كما هو.
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SensationDetailDto)
  sensationDetails?: SensationDetailDto[];
  // قوة العضلات: EXCELLENT | MODERATE | WEAK
  // السفلي: الفخذ والساق/القدم — العلوي: العضد والساعد
  @IsOptional() @IsString() thighMuscleStrength?: string;
  @IsOptional() @IsString() legFootMuscleStrength?: string;
  @IsOptional() @IsString() upperArmMuscleStrength?: string;
  @IsOptional() @IsString() forearmMuscleStrength?: string;
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
