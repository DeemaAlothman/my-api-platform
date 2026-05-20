import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsBoolean, IsNumber, IsIn } from 'class-validator';

export class CreateWorkScheduleDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  nameAr: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsString()
  @IsOptional()
  workStartTime?: string; // Format: "HH:mm"

  @IsString()
  @IsOptional()
  workEndTime?: string; // Format: "HH:mm"

  @IsString()
  @IsOptional()
  breakStartTime?: string; // Format: "HH:mm"

  @IsString()
  @IsOptional()
  breakEndTime?: string; // Format: "HH:mm"

  @IsInt()
  @Min(0)
  @IsOptional()
  breakDurationMin?: number;

  @IsString()
  @IsOptional()
  workDays?: string; // JSON array: "[0,1,2,3,4]"

  @IsInt()
  @Min(0)
  @IsOptional()
  lateToleranceMin?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  earlyLeaveToleranceMin?: number;

  @IsBoolean()
  @IsOptional()
  allowOvertime?: boolean;

  @IsNumber()
  @IsOptional()
  maxOvertimeHours?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['DAY', 'NIGHT', 'SPLIT', 'FLEXIBLE'])
  shiftType?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  minimumWorkMinutes?: number;

  @IsBoolean()
  @IsOptional()
  requiresContinuousWork?: boolean;
}
