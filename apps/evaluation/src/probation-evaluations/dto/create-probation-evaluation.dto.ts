import { IsString, IsOptional, IsDateString, IsBoolean, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ProbationRating {
  UNACCEPTABLE = 'UNACCEPTABLE',
  ACCEPTABLE = 'ACCEPTABLE',
  GOOD = 'GOOD',
  VERY_GOOD = 'VERY_GOOD',
  EXCELLENT = 'EXCELLENT',
}

export enum ProbationRecommendation {
  EXTEND_PROBATION = 'EXTEND_PROBATION',
  CONFIRM_POSITION = 'CONFIRM_POSITION',
  TRANSFER_POSITION = 'TRANSFER_POSITION',
  TERMINATE = 'TERMINATE',
}

export class CriteriaScoreDto {
  @ApiProperty() @IsString() criteriaId: string;
  @ApiProperty({ enum: ProbationRating }) @IsEnum(ProbationRating) score: ProbationRating;
}

export class CreateProbationEvaluationDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiProperty() @IsDateString() hireDate: string;
  @ApiProperty() @IsDateString() probationEndDate: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() evaluationDate?: string;
  @ApiProperty() @IsString() evaluatorId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() evaluatorNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDelegated?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() delegationNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seniorManagerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workAreasNote?: string;

  @ApiPropertyOptional({ type: [CriteriaScoreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriteriaScoreDto)
  scores?: CriteriaScoreDto[];
}

export class WorkflowActionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ enum: ProbationRecommendation })
  @IsOptional()
  @IsEnum(ProbationRecommendation)
  recommendation?: ProbationRecommendation;
  @ApiPropertyOptional({ enum: ProbationRating })
  @IsOptional()
  @IsEnum(ProbationRating)
  overallRating?: ProbationRating;
  @ApiPropertyOptional({ type: [CriteriaScoreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriteriaScoreDto)
  scores?: CriteriaScoreDto[];
}
