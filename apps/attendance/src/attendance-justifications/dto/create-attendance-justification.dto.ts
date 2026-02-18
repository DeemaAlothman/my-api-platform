import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateAttendanceJustificationDto {
  @IsString()
  @IsNotEmpty()
  alertId: string;

  @IsEnum(['SICK', 'EMERGENCY', 'OFFICIAL_MISSION', 'TRANSPORTATION', 'OTHER'])
  @IsNotEmpty()
  justificationType: string;

  @IsString()
  @IsNotEmpty()
  descriptionAr: string;

  @IsString()
  @IsOptional()
  descriptionEn?: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}
