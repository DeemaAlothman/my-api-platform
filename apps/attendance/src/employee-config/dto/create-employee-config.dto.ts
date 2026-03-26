import { IsString, IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateEmployeeConfigDto {
  @IsString()
  employeeId: string;

  @IsOptional()
  @IsBoolean()
  salaryLinked?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  allowedBreakMinutes?: number;
}
