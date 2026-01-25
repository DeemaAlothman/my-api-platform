import { IsString, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class UpdatePeriodDto {
  @IsString()
  @IsOptional()
  nameAr?: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
