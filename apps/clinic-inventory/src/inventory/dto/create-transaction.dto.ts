import { IsString, IsEnum, IsOptional, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum TransactionType { RECEIVED = 'RECEIVED', ISSUED = 'ISSUED', ADJUSTED = 'ADJUSTED', RETURNED = 'RETURNED', EXPIRED = 'EXPIRED' }

export class CreateTransactionDto {
  @IsEnum(TransactionType) type: TransactionType;
  @Type(() => Number) @IsNumber() quantity: number;
  @IsOptional() @IsString() receivedFromSupplier?: string;
  @IsOptional() @IsString() poNumber?: string;
  @IsOptional() @IsString() issuedToCaseId?: string;
  @IsOptional() @IsString() issuedToPatientId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class InternalDeductDto {
  @IsUUID() itemId: string;
  @Type(() => Number) @IsNumber() quantity: number;
  @IsOptional() @IsString() issuedToCaseId?: string;
  @IsOptional() @IsString() issuedToPatientId?: string;
  @IsOptional() @IsString() reason?: string;
  @IsString() userId: string;
}
