import {
  IsString, IsEnum, IsOptional, IsInt, IsArray, IsDateString, IsNumber, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SourceType {
  DOCTOR      = 'DOCTOR',
  HOSPITAL    = 'HOSPITAL',
  ASSOCIATION = 'ASSOCIATION',
}

export enum VisitType {
  INTRODUCTORY = 'INTRODUCTORY',
  FOLLOW_UP    = 'FOLLOW_UP',
}

export class CreateSourceDto {
  @IsEnum(SourceType) type: SourceType;

  @IsString() name: string;
  @IsOptional() @IsString() specialty?: string;

  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsString() address?: string;

  @IsOptional() @IsString() clinicPhone?: string;
  @IsOptional() @IsString() mobile?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) clinicRating?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) patientDensityRating?: number;

  @IsOptional() @IsArray() @IsString({ each: true }) interests?: string[];
  @IsOptional() @IsString() visitDays?: string;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateSourceDto {
  @IsOptional() @IsEnum(SourceType) type?: SourceType;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() specialty?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() clinicPhone?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) clinicRating?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) patientDensityRating?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) interests?: string[];
  @IsOptional() @IsString() visitDays?: string;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreateVisitDto {
  @IsEnum(VisitType) visitType: VisitType;
  @IsDateString() visitDate: string;
  @IsOptional() @IsString() topics?: string;
  @IsOptional() @IsDateString() nextVisitDate?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateVisitDto {
  @IsOptional() @IsEnum(VisitType) visitType?: VisitType;
  @IsOptional() @IsDateString() visitDate?: string;
  @IsOptional() @IsString() topics?: string;
  @IsOptional() @IsDateString() nextVisitDate?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ListSourcesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
  @IsOptional() @IsEnum(SourceType) type?: SourceType;
  @IsOptional() @IsString() search?: string;
}
