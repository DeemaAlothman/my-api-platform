import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum DiscountTypeEnum {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export class PurchaseInvoiceItemInputDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0.001) qty: number;
  // اختياري: أمين المستودع بينشئ الفاتورة بدون سعر، والمدير المالي بيحدده لاحقاً عند الاعتماد
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitPrice?: number;
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

// تسعير فاتورة الشراء عند الاعتماد المالي — سعر فقط، لا يوجد حقل كمية إطلاقاً
export class SetPurchaseInvoiceItemPriceDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
}

export class ApprovePurchaseInvoiceDto {
  // اختياري: لو ما انبعت، لازم كل الأصناف يكون عندها سعر محدَّد مسبقاً وإلا يُرفض الاعتماد.
  // لو انبعت، لازم يغطّي كل أصناف الفاتورة بالضبط (لا أقل ولا أكثر).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetPurchaseInvoiceItemPriceDto)
  items?: SetPurchaseInvoiceItemPriceDto[];
}
