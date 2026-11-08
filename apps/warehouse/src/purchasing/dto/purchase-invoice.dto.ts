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
  // اختياري: أمين المستودع ما بيحدد العملة ولا الخصم — المدير المالي بيحددهم عند الاعتماد
  @IsOptional() @IsString() @IsNotEmpty() currencyId?: string;
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

  // إجباري إذا الفاتورة ما إلها عملة بعد (كل الفواتير الجديدة تقريباً) — وإلا 400
  @IsOptional() @IsString() @IsNotEmpty() currencyId?: string;

  @IsOptional() @IsEnum(DiscountTypeEnum) discountType?: DiscountTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountValue?: number;

  // سعر صرف يدوي خاص بهي الفاتورة بالذات (كم ليرة = 1 دولار) — لو ما انبعت، يُستخدم
  // آخر سعر عام مسجَّل تلقائياً (نفس سلوك جدول العملات العام)
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.00000001) exchangeRate?: number;
}

// طلب إلغاء (مدير المستودع) — بانتظار قرار المدير المالي
export class RequestCancelPurchaseInvoiceDto {
  @IsOptional() @IsString() reason?: string;
}

// إلغاء فعلي أو اعتماد طلب إلغاء قائم (المدير المالي فقط)
export class CancelPurchaseInvoiceDto {
  @IsOptional() @IsString() reason?: string;
}

// رفض طلب إلغاء قائم (المدير المالي) — ترجع الفاتورة لحالتها السابقة
export class RejectCancelRequestDto {
  @IsOptional() @IsString() reason?: string;
}
