import { IsString, IsOptional, IsArray, IsInt, Min, Max, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ComplaintDto {
  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsString()
  historyOfSymptoms?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedSide?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  footSymptoms?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visitTypes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  vasScore?: number;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  activities?: string;
}

export class MedicalHistoryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  medicalHistory?: string[];

  @IsOptional()
  @IsString()
  medicalHistoryOther?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weight?: number;
}
