import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CandidateStage {
  PENDING                = 'PENDING',
  ELIGIBLE_FOR_INTERVIEW = 'ELIGIBLE_FOR_INTERVIEW',
  FINAL_ELIGIBLE         = 'FINAL_ELIGIBLE',
  CEO_APPROVAL           = 'CEO_APPROVAL',
  REFERENCE_CHECK        = 'REFERENCE_CHECK',
  HIRED                  = 'HIRED',
  REJECTED               = 'REJECTED',
}

export class MoveStageDto {
  @ApiProperty({ enum: CandidateStage }) @IsEnum(CandidateStage) stage: CandidateStage;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rejectionReason?: string;
}
