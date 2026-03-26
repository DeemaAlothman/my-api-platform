import { IsString, IsDateString } from 'class-validator';

export class DeviceCheckInDto {
  @IsString()
  employeeId: string;

  @IsDateString()
  checkInTime: string;

  @IsString()
  deviceSN: string;
}
