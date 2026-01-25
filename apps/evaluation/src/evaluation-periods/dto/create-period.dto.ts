import { IsString, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class CreatePeriodDto {
  @IsString()
  code: string;

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
