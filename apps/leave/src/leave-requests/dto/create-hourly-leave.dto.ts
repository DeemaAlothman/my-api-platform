import { IsString, IsNotEmpty, IsOptional, Matches, IsDateString } from 'class-validator';

export class CreateHourlyLeaveDto {
  @IsString()
  @IsNotEmpty()
  leaveTypeId: string;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime يجب أن يكون HH:mm' })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime يجب أن يكون HH:mm' })
  endTime: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
