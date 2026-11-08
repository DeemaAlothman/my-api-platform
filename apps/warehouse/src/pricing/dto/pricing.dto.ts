import { IsString, IsOptional, IsEnum, IsNumber, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export enum PriceBasisEnum {
  LAST_PURCHASE = 'LAST_PURCHASE',
  HIGHEST_PURCHASE = 'HIGHEST_PURCHASE',
}

export class ListProstheticsPricingQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
  @IsOptional() @IsString() search?: string;
}

export class UpsertItemMarkupDto {
  @Type(() => Number) @IsNumber() @Min(0) markupAmount: number;
  @IsOptional() @IsEnum(PriceBasisEnum) priceBasis?: PriceBasisEnum;
}
