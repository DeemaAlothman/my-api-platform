import { IsString, IsOptional, IsEnum, IsBoolean, IsNotEmpty } from 'class-validator';

export enum WarehouseTypeEnum {
  MAIN = 'MAIN',
  QUARANTINE = 'QUARANTINE',
  OTHER = 'OTHER',
}

export class CreateWarehouseDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsEnum(WarehouseTypeEnum) type?: WarehouseTypeEnum;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() managerEmployeeId?: string;
}

export class UpdateWarehouseDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(WarehouseTypeEnum) type?: WarehouseTypeEnum;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() managerEmployeeId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
