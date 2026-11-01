import { IsString, IsOptional, IsArray, IsNumber, registerDecorator, ValidationOptions } from 'class-validator';
import { Type } from 'class-transformer';

// كائن بسيط {حركة: درجة}: كل قيمة رقم >= 0، والكائن الفاضي {} مقبول ومعناه مسح الدرجات.
// المفاتيح ما بتتحقق من قائمة ثابتة، تماشياً مع muscleStrengthMovements/trunkStrengthMovements
// اللي بينحفظوا كنصوص حرة.
function IsGradeMap(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGradeMap',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined) return true;
          if (typeof value !== 'object' || Array.isArray(value)) return false;
          return Object.values(value as Record<string, unknown>).every(
            v => typeof v === 'number' && Number.isFinite(v) && v >= 0,
          );
        },
        defaultMessage() {
          return 'يجب أن يكون كائناً قيمه أرقام أكبر من أو تساوي صفر';
        },
      },
    });
  };
}

// تقييم أخصائي العلاج الفيزيائي — المشية والمدى الحركي والقوة العضلية وتقييم الجذع
export class PhysioAssessmentDto {
  // mobilityLevel: INDEPENDENT | WALKS_WITH_AIDS | WHEELCHAIR_USER
  @IsOptional() @IsString() mobilityLevel?: string;
  // assistiveDevices: CRUTCHES | WALKER | CANE | NONE
  @IsOptional() @IsArray() @IsString({ each: true }) assistiveDevices?: string[];
  // gaitProblems: TOE_DRAG | KNEE_INSTABILITY | PELVIS_TRUNK_TILT | SCISSORING_GAIT
  @IsOptional() @IsArray() @IsString({ each: true }) gaitProblems?: string[];

  // hipROM: FREE | LIMITED | DISLOCATED_SUBLUXED
  @IsOptional() @IsString() hipROM?: string;
  // kneeROM: NORMAL | FLEXION_CONTRACTURE | VALGUS_VARUS | GENU_RECURVATUM
  @IsOptional() @IsString() kneeROM?: string;
  // ankleROM: FREE | EQUINUS | VARUS_VALGUS
  @IsOptional() @IsString() ankleROM?: string;
  // الطرف العلوي — wristROM / elbowROM: FREE | LIMITED
  @IsOptional() @IsString() wristROM?: string;
  @IsOptional() @IsString() elbowROM?: string;

  // muscleStrengthMovements — الطرف السفلي: HIP_FLEXION | HIP_EXTENSION | HIP_ABDUCTION |
  // HIP_ADDUCTION | KNEE_FLEXION | KNEE_EXTENSION | ANKLE_DORSIFLEXION |
  // ANKLE_PLANTARFLEXION | ANKLE_EVERSION | ANKLE_INVERSION | GREAT_TOE_FLEXION
  // والطرف العلوي: ELBOW_FLEXION | ELBOW_EXTENSION | FOREARM_PRONATION |
  // FOREARM_SUPINATION | WRIST_FLEXION | WRIST_EXTENSION
  @IsOptional() @IsArray() @IsString({ each: true }) muscleStrengthMovements?: string[];
  // درجة كل حركة: { "HIP_FLEXION": 4, "ELBOW_EXTENSION": 3.5 }. يُرسَل كاملاً ويستبدل
  // القديم، و {} تمسح الدرجات، وحذف الحقل يتركه كما هو.
  @IsOptional() @IsGradeMap() muscleStrengthGrades?: Record<string, number>;
  // deformityFlexibility: FLEXIBLE | RIGID
  @IsOptional() @IsString() deformityFlexibility?: string;
  // deformityStatus: ACTIVE | DORMANT
  @IsOptional() @IsString() deformityStatus?: string;

  // trunkStrengthMovements: TRUNK_FLEXION | TRUNK_EXTENSION | RIGHT_LATERAL_TILT |
  // LEFT_LATERAL_TILT | ROTATION_RIGHT | ROTATION_LEFT
  @IsOptional() @IsArray() @IsString({ each: true }) trunkStrengthMovements?: string[];
  // درجة كل حركة جذعية: { "TRUNK_FLEXION": 4, "ROTATION_LEFT": 2 }. نفس قواعد
  // muscleStrengthGrades تماماً.
  @IsOptional() @IsGradeMap() trunkStrengthGrades?: Record<string, number>;
  // trunk*: GOOD | MODERATE | WEAK | ABSENT
  @IsOptional() @IsString() trunkControlSitting?: string;
  @IsOptional() @IsString() trunkBalanceDynamicSitting?: string;
  @IsOptional() @IsString() trunkControlStanding?: string;
  @IsOptional() @IsString() trunkBalanceStaticStanding?: string;
  @IsOptional() @IsString() trunkBalanceDynamicStanding?: string;

  // activityLevel: K0 | K1 | K2 | K3 | K4
  @IsOptional() @IsString() activityLevel?: string;

  // مدة الاستخدام اليومية بالساعات — انتقلت هنا من نموذج أخصائي الأطراف الصناعية
  @IsOptional() @IsNumber() @Type(() => Number) dailyWearHours?: number;

  // رأي أخصائي العلاج الفيزيائي النهائي
  @IsOptional() @IsString() physioOpinion?: string;
}
