import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateMappingDto {
  @IsString()
  employeeId: string;

  @IsString()
  pin: string;

  @IsString()
  deviceId: string;
}

export class BulkCreateMappingDto {
  @IsString({ each: true })
  mappings: { employeeId: string; pin: string; deviceId: string }[];
}
