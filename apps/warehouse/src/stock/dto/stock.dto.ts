import { IsString, IsNotEmpty, IsEnum, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export enum StockDirection {
  IN = 'IN',
  OUT = 'OUT',
}

// إدخال/إخراج يدوي بهذه المرحلة — بديله لاحقاً مستندات فاتورة إدخال/إخراج رسمية
export class AdjustStockDto {
  @IsString() @IsNotEmpty() warehouseId: string;
  @IsString() @IsNotEmpty() itemId: string;
  @IsEnum(StockDirection) direction: StockDirection;
  @Type(() => Number) @IsNumber() @Min(0.001) quantity: number;
  @IsOptional() @IsString() notes?: string;
}

export class SetMinStockDto {
  @IsString() @IsNotEmpty() warehouseId: string;
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0) minStock: number;
}
