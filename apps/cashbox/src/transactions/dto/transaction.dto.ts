import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DisbursementDto {
  @IsString() @IsNotEmpty() cashBoxId: string;
  @IsString() @IsNotEmpty() targetEmployeeId: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() currencyId: string;
  @IsString() @IsNotEmpty() reason: string;
}

// من مريض أو زبون — بالضبط واحد منهم
export class ReceiptDto {
  @IsString() @IsNotEmpty() cashBoxId: string;
  @IsOptional() @IsString() @IsNotEmpty() patientId?: string;
  @IsOptional() @IsString() @IsNotEmpty() customerId?: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() currencyId: string;
  @IsString() @IsNotEmpty() reason: string;
}

// تسليم من صندوق فرعي للرئيسي — الصندوق الرئيسي يُحدَّد تلقائياً (واحد بس دايماً)
export class HandoverDto {
  @IsString() @IsNotEmpty() cashBoxId: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() currencyId: string;
  @IsOptional() @IsString() reason?: string;
}

// تعبئة صندوق فرعي من الرئيسي — الصندوق الرئيسي يُحدَّد تلقائياً
export class RefillDto {
  @IsString() @IsNotEmpty() cashBoxId: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() currencyId: string;
  @IsOptional() @IsString() reason?: string;
}

export class ListTransactionsQueryDto {
  @IsOptional() @IsString() cashBoxId?: string;
  @IsOptional() @IsString() transactionType?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}
