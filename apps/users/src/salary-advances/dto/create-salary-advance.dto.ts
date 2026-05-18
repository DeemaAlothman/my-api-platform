import { IsString, IsInt, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class CreateSalaryAdvanceDto {
  @IsString()
  employeeId: string;

  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @IsNumber()
  @Min(0.01)
  installmentAmount: number;

  @IsInt()
  @Min(1)
  totalInstallments: number;

  @IsInt()
  @Min(2020)
  startYear: number;

  @IsInt()
  @Min(1)
  @Max(12)
  startMonth: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
