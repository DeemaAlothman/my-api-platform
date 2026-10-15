import { IsString, IsOptional, IsArray } from 'class-validator';

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

  // muscleStrengthMovements: HIP_FLEXION | HIP_EXTENSION | HIP_ABDUCTION | HIP_ADDUCTION |
  // KNEE_FLEXION | KNEE_EXTENSION | ANKLE_DORSIFLEXION | ANKLE_PLANTARFLEXION |
  // ANKLE_EVERSION | ANKLE_INVERSION | GREAT_TOE_FLEXION
  @IsOptional() @IsArray() @IsString({ each: true }) muscleStrengthMovements?: string[];
  // deformityFlexibility: FLEXIBLE | RIGID
  @IsOptional() @IsString() deformityFlexibility?: string;
  // deformityStatus: ACTIVE | DORMANT
  @IsOptional() @IsString() deformityStatus?: string;

  // trunkStrengthMovements: TRUNK_FLEXION | TRUNK_EXTENSION | RIGHT_LATERAL_TILT |
  // LEFT_LATERAL_TILT | ROTATION_RIGHT | ROTATION_LEFT
  @IsOptional() @IsArray() @IsString({ each: true }) trunkStrengthMovements?: string[];
  // trunk*: GOOD | MODERATE | WEAK | ABSENT
  @IsOptional() @IsString() trunkControlSitting?: string;
  @IsOptional() @IsString() trunkBalanceDynamicSitting?: string;
  @IsOptional() @IsString() trunkControlStanding?: string;
  @IsOptional() @IsString() trunkBalanceStaticStanding?: string;
  @IsOptional() @IsString() trunkBalanceDynamicStanding?: string;

  // activityLevel: K0 | K1 | K2 | K3 | K4
  @IsOptional() @IsString() activityLevel?: string;

  // رأي أخصائي العلاج الفيزيائي النهائي
  @IsOptional() @IsString() physioOpinion?: string;
}
