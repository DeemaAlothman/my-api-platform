import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum QuotationLineTypeEnum {
  ITEM = 'ITEM',
  SERVICE = 'SERVICE',
  SESSION = 'SESSION',
  CUSTOM = 'CUSTOM',
}

export enum DiscountTypeEnum {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export class QuotationItemInputDto {
  @IsOptional() @IsEnum(QuotationLineTypeEnum) lineType?: QuotationLineTypeEnum;
  @IsOptional() @IsString() itemId?: string; // مطلوب فقط لو lineType=ITEM
  @IsString() @IsNotEmpty() description: string;
  @Type(() => Number) @IsNumber() @Min(0.001) qty: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @IsEnum(DiscountTypeEnum) discountType?: DiscountTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountValue?: number;
}

export class CreateQuotationDto {
  @IsString() @IsNotEmpty() patientId: string;
  @IsString() @IsNotEmpty() currencyId: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(DiscountTypeEnum) discountType?: DiscountTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountValue?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  items: QuotationItemInputDto[];
}

// تعديل مباشر مسموح فقط أثناء DRAFT — استبدال كامل للبنود
export class UpdateQuotationDto {
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(DiscountTypeEnum) discountType?: DiscountTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountValue?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  items?: QuotationItemInputDto[];
}

// تعديل عرض بعد اعتماده = نسخة جديدة (نفس المريض والعملة، بقية الحقول قابلة للتغيير)
export class NewQuotationVersionDto {
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(DiscountTypeEnum) discountType?: DiscountTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountValue?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  items?: QuotationItemInputDto[];
}

// صلاحية edit_prices فقط — تعديل الأسعار/الخصومات بدون فتح نسخة جديدة (قبل الإرسال)
export class AdjustQuotationPriceItemDto {
  @IsString() @IsNotEmpty() quotationItemId: string;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @IsEnum(DiscountTypeEnum) discountType?: DiscountTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountValue?: number;
}

export class AdjustQuotationPricesDto {
  @IsOptional() @IsEnum(DiscountTypeEnum) discountType?: DiscountTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountValue?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdjustQuotationPriceItemDto)
  items?: AdjustQuotationPriceItemDto[];
}

export class AcceptQuotationDto {
  @IsOptional() @IsString() acceptedByName?: string;
}

export class RejectQuotationDto {
  @IsOptional() @IsString() reason?: string;
}
