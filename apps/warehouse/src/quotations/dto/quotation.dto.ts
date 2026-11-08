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
  // اختياري لبنود ITEM إذا كان الصنف مُسعَّر بإعدادات تسعير الأطراف الصناعية (السعر يُؤخذ
  // تلقائياً من هناك ويتجاهل أي قيمة مبعوتة) — إجباري وإلا (الصنف غير مُسعَّر، أو بند خدمة/حر)
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitPrice?: number;
}

export class CreateQuotationDto {
  // العرض إما لمريض أو لزبون مبيعات (/referrals/customers) — بالضبط واحد منهم، وإلا 400
  @IsOptional() @IsString() @IsNotEmpty() patientId?: string;
  @IsOptional() @IsString() @IsNotEmpty() customerId?: string;
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
  // لتغيير صاحب العرض: ابعت واحد منهم بس — بيلغي التاني تلقائياً. بعت الاثنين سوا = 400
  @IsOptional() @IsString() @IsNotEmpty() patientId?: string;
  @IsOptional() @IsString() @IsNotEmpty() customerId?: string;
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

// تعديل عرض بعد اعتماده = نسخة جديدة (نفس المريض/الزبون والعملة افتراضياً، بقية الحقول قابلة للتغيير)
export class NewQuotationVersionDto {
  // نفس قاعدة UpdateQuotationDto — ابعت واحد منهم بس لو بدك تغيّري صاحب العرض بالنسخة الجديدة
  @IsOptional() @IsString() @IsNotEmpty() patientId?: string;
  @IsOptional() @IsString() @IsNotEmpty() customerId?: string;
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

// صلاحية edit_prices فقط — تعديل الأسعار بدون فتح نسخة جديدة (قبل الإرسال). بدون خصم لكل
// بند — الخصم صار فقط على إجمالي العرض (discountType/discountValue بالأعلى)
export class AdjustQuotationPriceItemDto {
  @IsString() @IsNotEmpty() quotationItemId: string;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
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
