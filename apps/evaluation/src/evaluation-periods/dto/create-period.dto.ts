import { IsString, IsDateString, IsOptional, IsBoolean, Allow } from 'class-validator';

export class CreatePeriodDto {
  @Allow()
  code?: string;

  @IsString()
  nameAr: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
