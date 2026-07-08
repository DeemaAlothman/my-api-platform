import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsUUID, IsNotIn } from 'class-validator';
import { Type } from 'class-transformer';

export enum InventoryType { COMPONENT = 'COMPONENT', CONSUMABLE = 'CONSUMABLE' }
export enum ItemRequestStatus {
  PENDING       = 'PENDING',
  APPROVED      = 'APPROVED',
  DONE          = 'DONE',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
}

export class CreateItemDto {
  @IsString() partCode: string;
  @IsString() name: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() categoryId?: number;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsString() unit: string;
  @IsOptional() @IsEnum(InventoryType) type?: InventoryType;
  @IsOptional() @Type(() => Number) @IsNumber() currentStock?: number;
  @IsOptional() @Type(() => Number) @IsNumber() minStockLevel?: number;
  @IsOptional() @Type(() => Number) @IsNumber() unitCostUsd?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(ItemRequestStatus) status?: ItemRequestStatus;
  @IsOptional() @IsBoolean() isRequest?: boolean;
}
