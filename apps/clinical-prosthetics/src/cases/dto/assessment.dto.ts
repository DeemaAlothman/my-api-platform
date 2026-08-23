import { IsString, IsOptional, IsBoolean, IsInt, IsArray, IsEnum, IsObject, Min, Max, IsNumber } from 'class-validator';
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

  // إحساس وهمي: موجود أو غير موجود
  @IsOptional() @IsBoolean()
  phantomSensationPresent?: boolean;

  // ألم وهمي — يُعبّى فقط إذا phantomSensationPresent = true
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

// تقييم بتر علوي فوق المرفق (Transhumeral - TH)
export class TranshumeralAssessmentDto {
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  notes?: string;

  // طرف سليم: مفاتيح "1" إلى "10"
  @IsOptional() @IsObject()
  soundLimb?: Record<string, string | number | null>;

  // طرف مصاب: مفاتيح "1" إلى "6"
  @IsOptional() @IsObject()
  affectedLimb?: Record<string, string | number | null>;

  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}

// تقييم بتر علوي عبر المرفق (Elbow Disarticulation - ED)
export class ElbowDisarticulationAssessmentDto {
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  notes?: string;

  // طرف سليم: مفاتيح "1" إلى "12"
  @IsOptional() @IsObject()
  soundLimb?: Record<string, string | number | null>;

  // طرف مصاب: مفاتيح "1" إلى "9"
  @IsOptional() @IsObject()
  affectedLimb?: Record<string, string | number | null>;

  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}

// تقييم بتر علوي تحت المرفق (Transradial - TR)
export class TransradialAssessmentDto {
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  notes?: string;

  // طرف سليم: مفاتيح "1" إلى "7"
  @IsOptional() @IsObject()
  soundLimb?: Record<string, string | number | null>;

  // طرف مصاب: مفاتيح "1" إلى "10"
  @IsOptional() @IsObject()
  affectedLimb?: Record<string, string | number | null>;

  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}

// تقييم بتر سفلي عبر الحوض (Hemipelvectomy - HP)
export class HemipelvectomyAssessmentDto {
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  footMeasurement?: string;

  // طرف سليم: مفاتيح "1" إلى "15"
  @IsOptional() @IsObject()
  soundLimb?: Record<string, string | number | null>;

  // طرف مصاب: مفتاح "1" فقط
  @IsOptional() @IsObject()
  affectedLimb?: Record<string, string | number | null>;

  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}

// تقييم بتر سفلي تحت الركبة (Transtibial - TT)
export class TranstibialAssessmentDto {
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  footMeasurement?: string;

  // طرف سليم: مفاتيح "1" إلى "5"
  @IsOptional() @IsObject()
  soundLimb?: Record<string, string | number | null>;

  // طرف مصاب: مفاتيح "1" إلى "19"
  @IsOptional() @IsObject()
  affectedLimb?: Record<string, string | number | null>;

  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}

// تقييم بتر سفلي فوق الركبة (Transfemoral - TF)
export class TransfemoralAssessmentDto {
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  footMeasurement?: string;

  // طرف سليم: مفاتيح "1" إلى "11"
  @IsOptional() @IsObject()
  soundLimb?: Record<string, string | number | null>;

  // طرف مصاب: مفاتيح "1" إلى "12"
  @IsOptional() @IsObject()
  affectedLimb?: Record<string, string | number | null>;

  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}

// تقييم بتر سفلي عبر الركبة (Knee Disarticulation - KD)
export class KneeDisarticulationAssessmentDto {
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  footMeasurement?: string;

  // طرف سليم: مفاتيح "1" إلى "5"
  @IsOptional() @IsObject()
  soundLimb?: Record<string, string | number | null>;

  // طرف مصاب: مفاتيح "1" إلى "12"
  @IsOptional() @IsObject()
  affectedLimb?: Record<string, string | number | null>;

  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}

// تقييم بتر سفلي عبر الكاحل (Ankle Disarticulation - AD)
export class AnkleDisarticulationAssessmentDto {
  @IsEnum(['LEFT', 'RIGHT'])
  side: string;

  @IsOptional() @IsString()
  notes?: string;

  // قياس القدم (نص حر — يمكن أن يكون رقماً أو وصفاً)
  @IsOptional() @IsString()
  footMeasurement?: string;

  // طرف سليم: كائن بمفاتيح "1" إلى "5" وقيمة لكل منها
  @IsOptional() @IsObject()
  soundLimb?: Record<string, string | number | null>;

  // طرف مصاب: كائن بمفاتيح "1" إلى "19" وقيمة لكل منها
  @IsOptional() @IsObject()
  affectedLimb?: Record<string, string | number | null>;

  @IsOptional() @IsArray()
  examinerProsthetistIds?: string[];

  @IsOptional() @IsArray()
  examinerPhysioIds?: string[];

  @IsOptional() @IsArray()
  examinerSupervisorIds?: string[];
}
