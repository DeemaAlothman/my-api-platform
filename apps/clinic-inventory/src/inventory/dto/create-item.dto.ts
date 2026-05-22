import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum InventoryType { COMPONENT = 'COMPONENT', CONSUMABLE = 'CONSUMABLE' }

export class CreateItemDto {
  @IsString() partCode: string;
  @IsString() name: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsNumber() categoryId: number;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsString() unit: string;
  @IsEnum(InventoryType) type: InventoryType;
  @IsOptional() @Type(() => Number) @IsNumber() minStockLevel?: number;
  @IsOptional() @Type(() => Number) @IsNumber() unitCostUsd?: number;
  @IsOptional() @IsString() imageUrl?: string;
}
