import { IsString, IsOptional, IsArray } from 'class-validator';

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

  // رأي طبيب العظمية النهائي
  @IsOptional() @IsString() doctorOpinion?: string;
}
