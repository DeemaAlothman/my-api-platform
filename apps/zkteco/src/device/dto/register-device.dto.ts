import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  serialNumber: string;

  @IsString()
  nameAr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
