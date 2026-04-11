import { IsString, IsOptional, IsEnum, IsArray, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WorkType { FULL_TIME = 'FULL_TIME', PART_TIME = 'PART_TIME' }
export enum WorkMode { ON_SITE = 'ON_SITE', REMOTE = 'REMOTE', HYBRID = 'HYBRID' }

export class CreateInterviewPositionDto {
  @ApiProperty() @IsString() jobTitle: string;
  @ApiProperty() @IsString() department: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sectorName?: string;
  @ApiPropertyOptional({ enum: WorkType }) @IsOptional() @IsEnum(WorkType) workType?: WorkType;
  @ApiPropertyOptional({ enum: WorkMode }) @IsOptional() @IsEnum(WorkMode) workMode?: WorkMode;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() committeeMembers?: string[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() interviewDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresLanguage?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresComputer?: boolean;
}
