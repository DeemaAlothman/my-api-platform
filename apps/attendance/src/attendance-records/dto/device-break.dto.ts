import { IsString, IsDateString, IsIn, IsOptional } from 'class-validator';

export class DeviceBreakDto {
  @IsString()
  employeeId: string;

  @IsDateString()
  timestamp: string;

  @IsIn(['OUT', 'IN'])
  type: 'OUT' | 'IN';

  @IsString()
  deviceSN: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
