import {
  IsString, IsOptional, IsEnum, IsInt, Min, Max, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum GenderEnum {
  MALE   = 'MALE',
  FEMALE = 'FEMALE',
}

export enum ArrivalMethodEnum {
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  HOSPITAL     = 'HOSPITAL',
  DOCTOR       = 'DOCTOR',
  ASSOCIATION  = 'ASSOCIATION',
  FRIEND       = 'FRIEND',
  STAFF        = 'STAFF',
}

export enum WaitingListStatusEnum {
  WAITING       = 'WAITING',
  SCHEDULED     = 'SCHEDULED',
  NOT_SCHEDULED = 'NOT_SCHEDULED',
}

export class CreateWaitingListEntryDto {
  @IsString() @IsNotEmpty()
  patientName: string;

  @IsEnum(GenderEnum)
  gender: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  age?: number;

  @IsOptional() @IsEnum(ArrivalMethodEnum)
  arrivalMethod?: string;

  @IsString() @IsNotEmpty()
  serviceType: string;

  @IsString() @IsNotEmpty()
  contactNumber: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(5)
  priority: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateWaitingListEntryDto {
  @IsOptional() @IsString() @IsNotEmpty()
  patientName?: string;

  @IsOptional() @IsEnum(GenderEnum)
  gender?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  age?: number;

  @IsOptional() @IsEnum(ArrivalMethodEnum)
  arrivalMethod?: string;

  @IsOptional() @IsString() @IsNotEmpty()
  serviceType?: string;

  @IsOptional() @IsString() @IsNotEmpty()
  contactNumber?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  priority?: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsEnum(WaitingListStatusEnum)
  status?: string;
}

export class ListWaitingListQueryDto {
  @IsOptional() @IsEnum(WaitingListStatusEnum)
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 50;
}
