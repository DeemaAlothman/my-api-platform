import { IsOptional, IsDateString, IsString } from 'class-validator';

export class DateRangeQueryDto {
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsString() itemId?: string;
}
