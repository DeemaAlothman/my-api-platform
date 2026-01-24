import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min } from 'class-validator';

export class CreateAttendanceRecordDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsString()
  @IsOptional()
  clockInTime?: string; // ISO 8601

  @IsString()
  @IsOptional()
  clockOutTime?: string; // ISO 8601

  @IsEnum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND'])
  @IsOptional()
  status?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  lateMinutes?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  earlyLeaveMinutes?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  overtimeMinutes?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  workedMinutes?: number;

  @IsString()
  @IsOptional()
  clockInLocation?: string;

  @IsString()
  @IsOptional()
  clockOutLocation?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
