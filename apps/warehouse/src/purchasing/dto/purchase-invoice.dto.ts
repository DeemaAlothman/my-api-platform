import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum DiscountTypeEnum {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export class PurchaseInvoiceItemInputDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0.001) qty: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
}

export class CreatePurchaseInvoiceDto {
  @IsString() @IsNotEmpty() supplierId: string;
  @IsString() @IsNotEmpty() warehouseId: string;
  @IsString() @IsNotEmpty() currencyId: string;
  @IsOptional() @IsDateString() invoiceDate?: string;
  @IsOptional() @IsEnum(DiscountTypeEnum) discountType?: DiscountTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountValue?: number;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseInvoiceItemInputDto)
  items: PurchaseInvoiceItemInputDto[];
}

export class RejectPurchaseInvoiceDto {
  @IsOptional() @IsString() reason?: string;
}
