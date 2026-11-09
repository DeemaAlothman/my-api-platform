import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum CashBoxTypeEnum {
  MAIN = 'MAIN',
  SUB = 'SUB',
}

export class CreateCashBoxDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() custodianEmployeeId: string;
  @IsOptional() @IsEnum(CashBoxTypeEnum) type?: CashBoxTypeEnum;
}

export class UpdateCashBoxDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() @IsNotEmpty() custodianEmployeeId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
