import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCurrencyDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsBoolean() isBaseCurrency?: boolean;
}

export class SetExchangeRateDto {
  @Type(() => Number) @IsNumber() @Min(0.00000001) rate: number;
}
