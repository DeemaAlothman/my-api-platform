import { IsOptional, IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from './create-patient.dto';

export class ListPatientsQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsNumber() cityId?: number;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() governorate?: string;
  @IsOptional() @IsString() documentConsent?: string;
  @IsOptional() @IsString() consentDecision?: string;
  @IsOptional() @IsString() department?: string;
}
