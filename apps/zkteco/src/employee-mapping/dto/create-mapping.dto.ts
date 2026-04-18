import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMappingDto {
  @IsString()
  employeeId: string;

  @IsString()
  pin: string;

  @IsString()
  deviceId: string;
}

export class BulkCreateMappingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMappingDto)
  mappings: CreateMappingDto[];
}
