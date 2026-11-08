import { IsString, IsEnum, IsOptional, IsInt, Min, Max, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export enum CustomerGender {
  MALE   = 'MALE',
  FEMALE = 'FEMALE',
}

export enum CustomerArrivalMethod {
  HOSPITAL     = 'HOSPITAL',
  FRIEND       = 'FRIEND',
  DOCTOR       = 'DOCTOR',
  STAFF        = 'STAFF',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
}

export class CreateCustomerDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(CustomerGender) gender: CustomerGender;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsEnum(CustomerArrivalMethod) arrivalMethod?: CustomerArrivalMethod;
  @IsString() @IsNotEmpty() contactNumber: string;
  @IsOptional() @IsString() residence?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsEnum(CustomerGender) gender?: CustomerGender;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsEnum(CustomerArrivalMethod) arrivalMethod?: CustomerArrivalMethod;
  @IsOptional() @IsString() @IsNotEmpty() contactNumber?: string;
  @IsOptional() @IsString() residence?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ListCustomersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
  @IsOptional() @IsEnum(CustomerGender) gender?: CustomerGender;
  @IsOptional() @IsEnum(CustomerArrivalMethod) arrivalMethod?: CustomerArrivalMethod;
  @IsOptional() @IsString() search?: string;
}
