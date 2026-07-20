import { IsString, IsOptional, IsNumber, IsArray, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReceptionDto {
  @IsString()
  patientId: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weight?: number;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  activities?: string;

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
  @IsArray()
  @IsString({ each: true })
  medicalHistory?: string[];

  @IsOptional()
  @IsString()
  medicalHistoryOther?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  vasScore?: number;
}
