import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CandidateStage {
  NEW = 'NEW',
  INITIAL_REVIEW = 'INITIAL_REVIEW',
  PHONE_INTERVIEW = 'PHONE_INTERVIEW',
  TECHNICAL_INTERVIEW = 'TECHNICAL_INTERVIEW',
  FINAL_INTERVIEW = 'FINAL_INTERVIEW',
  OFFER_SENT = 'OFFER_SENT',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export class MoveStageDto {
  @ApiProperty({ enum: CandidateStage }) @IsEnum(CandidateStage) stage: CandidateStage;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rejectionReason?: string;
}
