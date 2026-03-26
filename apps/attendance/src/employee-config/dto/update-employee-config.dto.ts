import { IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateEmployeeConfigDto {
  @IsOptional()
  @IsBoolean()
  salaryLinked?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  allowedBreakMinutes?: number;
}
