import { IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @IsString()
  @IsOptional()
  checkInTime?: string; // ISO 8601 format

  @IsString()
  @IsOptional()
  date?: string; // YYYY-MM-DD

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
