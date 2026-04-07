import { IsString, IsOptional, IsEmail, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum CandidateSource {
  WEBSITE = 'WEBSITE',
  LINKEDIN = 'LINKEDIN',
  INTERNAL_REFERRAL = 'INTERNAL_REFERRAL',
  RECRUITMENT_AGENCY = 'RECRUITMENT_AGENCY',
  WALK_IN = 'WALK_IN',
  OTHER = 'OTHER',
}

export class CreateCandidateDto {
  @ApiProperty() @IsString() firstNameAr: string;
  @ApiProperty() @IsString() lastNameAr: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstNameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastNameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiProperty() @IsString() phone: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nationalId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() positionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(CandidateSource) source?: CandidateSource;
  @ApiPropertyOptional() @IsOptional() @IsString() cvUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) expectedSalary?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
