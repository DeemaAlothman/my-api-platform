import { IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum PriceBasisEnum {
  LAST_PURCHASE = 'LAST_PURCHASE',
  HIGHEST_PURCHASE = 'HIGHEST_PURCHASE',
}

export enum ProfitTypeEnum {
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
}

// إعداد عام واحد يُطبَّق على كل قطع الأطراف الصناعية
export class UpsertProstheticsPricingSettingsDto {
  // قيمة ثابتة تُضاف دايماً للسعر الأساس
  @Type(() => Number) @IsNumber() @Min(0) markupAmount: number;
  @IsOptional() @IsEnum(PriceBasisEnum) priceBasis?: PriceBasisEnum;
  // ربح إضافي اختياري فوق القيمة الثابتة — مبلغ ثابت أو نسبة من السعر الأساس، حسب profitType
  @IsOptional() @IsEnum(ProfitTypeEnum) profitType?: ProfitTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) profitValue?: number;
}
