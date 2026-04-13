import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString()
  @IsNotEmpty()
  leaveTypeId: string;

  @IsString()
  @IsNotEmpty()
  startDate: string; // ISO date

  @IsString()
  @IsNotEmpty()
  endDate: string; // ISO date

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean;

  @IsEnum(['MORNING', 'AFTERNOON'])
  @IsOptional()
  halfDayPeriod?: 'MORNING' | 'AFTERNOON';

  @IsString()
  @IsOptional()
  substituteId?: string;

  @IsString()
  @IsOptional()
  contactDuring?: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}
