import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StartInventoryCountDto {
  @IsString() @IsNotEmpty() warehouseId: string;
  @IsOptional() @IsString() notes?: string;
}

export class RecordCountItemDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0) actualQty: number;
  @IsOptional() @IsString() note?: string;
}

export class RecordCountsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordCountItemDto)
  items: RecordCountItemDto[];
}
