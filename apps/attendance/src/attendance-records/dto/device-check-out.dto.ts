import { IsString, IsDateString } from 'class-validator';

export class DeviceCheckOutDto {
  @IsString()
  employeeId: string;

  @IsDateString()
  checkOutTime: string;

  @IsString()
  deviceSN: string;
}
