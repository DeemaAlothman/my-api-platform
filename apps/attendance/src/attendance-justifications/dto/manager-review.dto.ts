import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ManagerReviewDto {
  @IsEnum(['APPROVE', 'REJECT'])
  @IsNotEmpty()
  decision: string;

  @IsString()
  @IsOptional()
  notesAr?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
