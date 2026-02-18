import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateEmployeeScheduleDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  scheduleId: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string; // YYYY-MM-DD

  @IsDateString()
  @IsOptional()
  effectiveTo?: string; // YYYY-MM-DD

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
