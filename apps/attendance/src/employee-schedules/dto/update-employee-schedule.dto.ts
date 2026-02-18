import { IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class UpdateEmployeeScheduleDto {
  @IsDateString()
  @IsOptional()
  effectiveTo?: string; // YYYY-MM-DD

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
