import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class HrReviewDto {
  @IsEnum(['APPROVE', 'APPROVE_WITH_DEDUCTION', 'REJECT'])
  @IsNotEmpty()
  decision: string;

  @IsString()
  @IsOptional()
  notesAr?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
