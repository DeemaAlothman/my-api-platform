import { IsString, IsOptional, IsBoolean, IsInt, IsArray, IsEnum, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpperLimbAssessmentDto {
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

  @IsOptional() @IsBoolean()
  phantomPainPresent?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  phantomPainIntensity?: number;

  @IsOptional() @IsBoolean()
  neuromaPalpable?: boolean;

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
  activityLevel?: string;

  @IsOptional() @IsBoolean()
  usesCompressionBandage?: boolean;

  @IsOptional() @IsObject()
  romData?: any;

  @IsOptional() @IsBoolean()
  canBalanceOneSide?: boolean;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  examinerProsthetistId: string;

  @IsString()
  examinerPhysioId: string;
}

export class LowerLimbAssessmentDto {
  @IsOptional() @IsString()
  loadTolerance?: string;

  @IsOptional() @IsString()
  weightBearingLevel?: string;

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

  @IsOptional() @IsBoolean()
  phantomPainPresent?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(10) @Type(() => Number)
  phantomPainIntensity?: number;

  @IsOptional() @IsBoolean()
  neuromaPalpable?: boolean;

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
  activityLevel?: string;

  @IsOptional() @IsObject()
  romData?: any;

  @IsOptional() @IsString()
  notes?: string;

  @IsString()
  examinerProsthetistId: string;

  @IsString()
  examinerPhysioId: string;
}
