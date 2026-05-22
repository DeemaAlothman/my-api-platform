import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsObject, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class AddComponentDto {
  @IsString()
  inventoryItemId: string;

  @IsString()
  partCode: string;

  @IsString()
  partName: string;

  @IsString()
  supplier: string;

  @IsString()
  sourceLocation: string;

  @IsOptional() @IsString()
  reason?: string;
}

export class GaitAnalysisDto {
  @IsOptional() @IsArray()
  suspensionSystem?: string[];

  @IsOptional() @IsString()
  socketBearing?: string;

  @IsOptional() @IsString()
  kneeJointType?: string;

  @IsOptional() @IsString()
  footType?: string;

  @IsOptional() @IsBoolean()
  socketPain?: boolean;

  @IsOptional() @IsBoolean()
  residualLimbPain?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  painIntensity?: number;

  @IsOptional() @IsString()
  alignmentCheck?: string;

  @IsOptional() @IsBoolean()
  hasRomLimitations?: boolean;

  @IsOptional() @IsBoolean()
  hasHipFlexionContracture?: boolean;

  @IsOptional() @IsBoolean()
  hasKneeFlexionContracture?: boolean;

  @IsOptional() @IsBoolean()
  weakHipAbductors?: boolean;

  @IsOptional() @IsBoolean()
  weakHipExtensors?: boolean;

  @IsOptional() @IsBoolean()
  weakTrunkMuscles?: boolean;

  @IsOptional() @IsString()
  otherWeakness?: string;

  @IsOptional() @IsString()
  trunkStability?: string;

  @IsOptional() @IsString()
  abdominalControl?: string;

  @IsOptional() @IsString()
  pelvicControl?: string;

  @IsOptional() @IsString()
  sittingBalance?: string;

  @IsOptional() @IsString()
  standingBalance?: string;

  @IsOptional() @IsString()
  assistiveDevice?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  speedMs?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  cadence?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stepLengthProsCm?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stepLengthSoundCm?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stancePercProsthetic?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stancePercSound?: number;

  @IsOptional() @IsString()
  symmetry?: string;

  @IsOptional() @IsObject()
  deviations?: any;

  @IsOptional() @IsString()
  mainProblem?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  examinerProsthetistId: string;

  @IsString()
  examinerPhysioId: string;
}

export class BalanceAssessmentDto {
  @IsObject()
  staticResults: any;

  @IsObject()
  dynamicResults: any;

  @IsObject()
  activityResults: any;

  @IsOptional() @IsBoolean()
  historyOfFalls?: boolean;

  @IsOptional() @IsBoolean()
  nearFalls?: boolean;

  @IsOptional() @IsBoolean()
  fearOfFalling?: boolean;

  @IsOptional() @IsString()
  fallRiskLevel?: string;

  @IsOptional() @IsString()
  overallBalanceLevel?: string;

  @IsOptional() @IsObject()
  exerciseProgram?: any;

  @IsOptional() @IsBoolean()
  homeExerciseProgram?: boolean;

  @IsOptional() @IsInt() @Type(() => Number)
  followUpWeeks?: number;

  @IsString()
  examinerPhysioId: string;

  @IsOptional() @IsString()
  committeeHeadId?: string;
}

export class TreatmentPlanDto {
  @IsOptional() @IsString()
  notes?: string;
}

export class WorkshopSessionDto {
  @IsDateString()
  sessionDate: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsString()
  providedService: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  technicianId: string;
}

export class PtSessionDto {
  @IsDateString()
  sessionDate: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsString()
  providedService: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  physiotherapistId: string;
}

export class MediaSessionDto {
  @IsDateString()
  sessionDate: string;

  @IsOptional() @IsString()
  sessionTime?: string;

  @IsString()
  providedService: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  supervisorId: string;
}

export class ConsumableDto {
  @IsString()
  inventoryItemId: string;

  @IsString()
  consumableName: string;

  @IsNumber() @Type(() => Number)
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  supervisorId: string;
}
