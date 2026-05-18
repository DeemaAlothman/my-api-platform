import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class UpdateSalaryAdvanceDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  installmentAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
