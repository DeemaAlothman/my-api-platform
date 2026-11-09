import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCashCountDto {
  @IsString() @IsNotEmpty() cashBoxId: string;
  @IsString() @IsNotEmpty() currencyId: string;
  @Type(() => Number) @IsNumber() @Min(0) actualBalance: number;
  @IsOptional() @IsString() notes?: string;
}

export class ListCashCountsQueryDto {
  @IsOptional() @IsString() cashBoxId?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}
