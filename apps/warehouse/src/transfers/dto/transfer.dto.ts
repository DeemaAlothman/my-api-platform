import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferItemInputDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0.001) qty: number;
}

export class CreateTransferDto {
  @IsString() @IsNotEmpty() fromWarehouseId: string;
  @IsString() @IsNotEmpty() toWarehouseId: string;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemInputDto)
  items: TransferItemInputDto[];
}

export class ReceiveItemInputDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0) receivedQty: number;
}

export class ReceiveTransferDto {
  // إذا لم تُرسل items، يُفترض استلام نفس الكمية المُرسَلة لكل بند تماماً
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemInputDto)
  items?: ReceiveItemInputDto[];
}
