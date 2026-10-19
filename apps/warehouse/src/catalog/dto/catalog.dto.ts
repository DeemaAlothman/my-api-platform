import { IsString, IsOptional, IsBoolean, IsNotEmpty, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUnitDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() symbol?: string;
}

export class UpdateUnitDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() symbol?: string;
}

export class CreateCategoryDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() parentId?: string;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateSupplierDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export enum ItemTypeEnum {
  COMPONENT = 'COMPONENT',
  CONSUMABLE = 'CONSUMABLE',
  SERVICE = 'SERVICE',
}

export class CreateItemDto {
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() partCode?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsEnum(ItemTypeEnum) itemType?: ItemTypeEnum;
  @IsOptional() @IsString() categoryId?: string;
  @IsString() @IsNotEmpty() unitId: string;
  @IsOptional() @IsString() manufacturerId?: string;
  @IsOptional() @IsBoolean() stockAlert?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minStock?: number;
}

export class UpdateItemDto {
  @IsOptional() @IsString() partCode?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsEnum(ItemTypeEnum) itemType?: ItemTypeEnum;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() unitId?: string;
  @IsOptional() @IsString() manufacturerId?: string;
  @IsOptional() @IsBoolean() stockAlert?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minStock?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateManufacturerDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() nameAr?: string;
}

export class UpdateManufacturerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() nameAr?: string;
}
