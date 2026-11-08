import { IsString, IsOptional, IsEnum, IsNumber, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export enum PriceBasisEnum {
  LAST_PURCHASE = 'LAST_PURCHASE',
  HIGHEST_PURCHASE = 'HIGHEST_PURCHASE',
}

export enum ProfitTypeEnum {
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
}

export class ListProstheticsPricingQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
  @IsOptional() @IsString() search?: string;
}

export class UpsertItemMarkupDto {
  // قيمة ثابتة تُضاف دايماً للسعر الأساس
  @Type(() => Number) @IsNumber() @Min(0) markupAmount: number;
  @IsOptional() @IsEnum(PriceBasisEnum) priceBasis?: PriceBasisEnum;
  // ربح إضافي اختياري فوق القيمة الثابتة — مبلغ ثابت أو نسبة من السعر الأساس، حسب profitType
  @IsOptional() @IsEnum(ProfitTypeEnum) profitType?: ProfitTypeEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) profitValue?: number;
}
