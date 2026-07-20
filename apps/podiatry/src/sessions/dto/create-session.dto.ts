import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSessionDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clinicalPlan?: string[];

  // القدم اليمنى
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  rightFlatFoot?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  rightHighArch?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  rightPronation?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  rightSupination?: boolean;

  @IsOptional()
  @IsString()
  rightPressureNotes?: string;

  @IsOptional()
  @IsString()
  rightAsymmetry?: string;

  // القدم اليسرى
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  leftFlatFoot?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  leftHighArch?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  leftPronation?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  leftSupination?: boolean;

  @IsOptional()
  @IsString()
  leftPressureNotes?: string;

  @IsOptional()
  @IsString()
  leftAsymmetry?: string;

  // التوقيع
  @IsOptional()
  @IsString()
  clinicianName?: string;

  @IsOptional()
  @IsString()
  clinicianSignature?: string;
}
