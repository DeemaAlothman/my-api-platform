import { IsString, IsOptional, IsBoolean, IsInt, IsNumber, IsIn, Min } from 'class-validator';

export class CreateDeductionPolicyDto {
  @IsString()
  nameAr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  lateToleranceMinutes?: number;

  @IsOptional()
  @IsString()
  @IsIn(['MINUTE_BY_MINUTE', 'TIERED'])
  lateDeductionType?: string;

  @IsOptional()
  @IsString()
  lateDeductionTiers?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MINUTE_BY_MINUTE', 'TIERED'])
  earlyLeaveDeductionType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  absenceDeductionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  repeatLateThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  repeatLatePenaltyDays?: number;

  @IsOptional()
  @IsString()
  @IsIn(['MINUTE_BY_MINUTE', 'IGNORE', 'DOUBLE'])
  breakOverLimitDeduction?: string;
}
