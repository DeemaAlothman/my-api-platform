import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class GeneratePayrollDto {
  @IsInt()
  @Min(2020)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  policyId?: string;
}
