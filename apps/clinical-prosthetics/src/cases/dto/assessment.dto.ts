import { IsString, IsOptional, IsBoolean, IsInt, IsArray, IsEnum, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpperLimbAssessmentDto {
  // الجانب المُقيَّم — مطلوب دائماً. بحالة ثنائي الأطراف، يُستدعى الـ endpoint مرتين (LEFT ثم RIGHT)
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  residualLimbLength?: string;

  @IsOptional() @IsString()
  residualLimbShape?: string;

  @IsOptional() @IsString()
  residualLimbPhotoUrl?: string;

  @IsOptional() @IsBoolean()
  painPresent?: boolean;

  @IsOptional() @IsString()
  painArea?: string;

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  painIntensity?: number;

  @IsOptional() @IsArray()
  painTypes?: string[];

  // يُعبّى فقط إذا كان أحد عناصر painTypes = OTHER
  @IsOptional() @IsString()
  painTypeOtherDetail?: string;

  @IsOptional() @IsBoolean()
  phantomPainPresent?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  phantomPainIntensity?: number;

  // حالة وضع الجذمور: قابل للمس / غير قابل للمس
  @IsOptional() @IsBoolean()
  residualLimbPalpable?: boolean;

  @IsOptional() @IsBoolean()
  neuromaPalpable?: boolean;

  @IsOptional() @IsArray()
  skinAppearance?: string[];

  @IsOptional() @IsString()
  skinNotes?: string;

  @IsOptional() @IsArray()
  skinColor?: string[];

  @IsOptional() @IsString()
  skinTemperature?: string;

  @IsOptional() @IsArray()
  scarCondition?: string[];

  @IsOptional() @IsBoolean()
  hasSkinGrafts?: boolean;

  @IsOptional() @IsString()
  graftArea?: string;

  // هل يوجد أطراف أخرى مصابة؟
  @IsOptional() @IsBoolean()
  hasOtherAffectedLimbs?: boolean;

  @IsOptional() @IsBoolean()
  canBalanceOneSide?: boolean;

  @IsOptional() @IsBoolean()
  usesCompressionBandage?: boolean;

  // تقييم مدى حركة المفاصل العام: NORMAL | ACTIVE | SEDENTARY
  @IsOptional() @IsString()
  jointsRangeOfMotion?: string;

  @IsOptional() @IsString()
  activityLevel?: string;

  // تفاصيل اختبار قوة وحركة العضلات (الكتف/المرفق/الرسغ/الاستلقاء.../الانحراف...)
  @IsOptional() @IsObject()
  romData?: any;

  @IsOptional() @IsString()
  muscleMotionNotes?: string;

  // ممكن أكثر من شخص بكل دور
  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}

export class LowerLimbAssessmentDto {
  // الجانب المُقيَّم — مطلوب دائماً. بحالة ثنائي الأطراف، يُستدعى الـ endpoint مرتين (LEFT ثم RIGHT)
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  residualLimbLength?: string;

  @IsOptional() @IsString()
  residualLimbShape?: string;

  @IsOptional() @IsString()
  residualLimbPhotoUrl?: string;

  // ملاحظة حول مستوى البتر
  @IsOptional() @IsString()
  amputationLevelNote?: string;

  @IsOptional() @IsBoolean()
  painPresent?: boolean;

  @IsOptional() @IsString()
  painArea?: string;

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  painIntensity?: number;

  @IsOptional() @IsArray()
  painTypes?: string[];

  // يُعبّى فقط إذا كان أحد عناصر painTypes = OTHER
  @IsOptional() @IsString()
  painTypeOtherDetail?: string;

  @IsOptional() @IsBoolean()
  phantomPainPresent?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  phantomPainIntensity?: number;

  @IsOptional() @IsBoolean()
  neuromaPalpable?: boolean;

  // قابلية التحميل على الجذمور: PALPABLE | NOT_PALPABLE | WEIGHT_BEARING | NON_WEIGHT_BEARING
  @IsOptional() @IsString()
  loadTolerance?: string;

  // يُعبّى فقط إذا loadTolerance = WEIGHT_BEARING — FULL | HIGH | MEDIUM | LOW
  @IsOptional() @IsString()
  weightBearingLevel?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsArray()
  skinAppearance?: string[];

  @IsOptional() @IsArray()
  skinColor?: string[];

  @IsOptional() @IsString()
  skinTemperature?: string;

  @IsOptional() @IsArray()
  scarCondition?: string[];

  @IsOptional() @IsBoolean()
  hasSkinGrafts?: boolean;

  @IsOptional() @IsString()
  graftArea?: string;

  @IsOptional() @IsString()
  otherLimbCondition?: string;

  @IsOptional() @IsBoolean()
  usesAssistiveDevices?: boolean;

  @IsOptional() @IsString()
  assistiveDeviceTypes?: string;

  @IsOptional() @IsBoolean()
  canClimbStairs?: boolean;

  @IsOptional() @IsBoolean()
  canBalanceOneSide?: boolean;

  // تقييم مدى حركة المفاصل العام: NORMAL | ACTIVE | SEDENTARY
  @IsOptional() @IsString()
  jointsRangeOfMotion?: string;

  @IsOptional() @IsString()
  activityLevel?: string;

  // تفاصيل اختبار قوة وحركة العضلات (الكاحل/الركبة/الورك)
  @IsOptional() @IsObject()
  romData?: any;

  @IsOptional() @IsString()
  muscleMotionNotes?: string;

  // ممكن أكثر من شخص بكل دور
  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}
