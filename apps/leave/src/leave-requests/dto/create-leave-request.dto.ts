import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, IsIn } from 'class-validator';

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

  @IsIn(['FIRST_DEGREE', 'SECOND_DEGREE'])
  @IsOptional()
  deceasedRelation?: 'FIRST_DEGREE' | 'SECOND_DEGREE';
}
