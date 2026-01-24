import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateAttendanceAlertDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsEnum(['LATE', 'ABSENT', 'EARLY_LEAVE', 'MISSING_CLOCK_OUT', 'CONSECUTIVE_ABSENCE'])
  @IsNotEmpty()
  alertType: string;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  @IsOptional()
  severity?: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  messageAr?: string;

  @IsEnum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  attendanceRecordId?: string;
}
