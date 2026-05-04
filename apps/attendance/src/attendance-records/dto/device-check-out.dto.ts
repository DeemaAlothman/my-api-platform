import { IsString, IsDateString, IsOptional } from 'class-validator';

export class DeviceCheckOutDto {
  @IsString()
  employeeId: string;

  @IsDateString()
  checkOutTime: string;

  @IsOptional()
  @IsString()
  deviceSN?: string;
}
