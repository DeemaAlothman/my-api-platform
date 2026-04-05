import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum EvaluationDecision {
  ACCEPTED = 'ACCEPTED',
  REFERRED_TO_OTHER = 'REFERRED_TO_OTHER',
  DEFERRED = 'DEFERRED',
  REJECTED = 'REJECTED',
}

export class CriteriaScoreDto {
  @ApiProperty() @IsString() criterionId: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(5) score: number;
}

export class TechnicalScoreDto {
  @ApiProperty() @IsString() questionId: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) score: number;
}

export class CreateInterviewEvaluationDto {
  @ApiProperty() @IsString() positionId: string;
  @ApiProperty() @IsString() jobApplicationId: string;
  @ApiProperty() @IsString() candidateName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() residence?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() maritalStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() academicDegree?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() yearsOfExperience?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() expectedSalary?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expectedJoinDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() generalNotes?: string;
  @ApiPropertyOptional({ enum: EvaluationDecision }) @IsOptional() @IsEnum(EvaluationDecision) decision?: EvaluationDecision;
  @ApiPropertyOptional() @IsOptional() @IsNumber() proposedSalary?: number;

  @ApiPropertyOptional({ type: [CriteriaScoreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriteriaScoreDto)
  personalScores?: CriteriaScoreDto[];

  @ApiPropertyOptional({ type: [TechnicalScoreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicalScoreDto)
  technicalScores?: TechnicalScoreDto[];

  @ApiPropertyOptional({ type: [CriteriaScoreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriteriaScoreDto)
  computerScores?: CriteriaScoreDto[];
}
