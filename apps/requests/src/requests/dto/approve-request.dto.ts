import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class ApproveRequestDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  penaltyDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  executiveRecommendation?: string;
}
