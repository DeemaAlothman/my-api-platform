import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReturnTypeEnum {
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  SALES_RETURN = 'SALES_RETURN',
  ISSUE_RETURN = 'ISSUE_RETURN',
  PRODUCTION_RETURN = 'PRODUCTION_RETURN',
}

export enum ReturnConditionEnum {
  GOOD = 'GOOD',
  DAMAGED = 'DAMAGED',
  INSPECT = 'INSPECT',
}

export class ReturnItemInputDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0.001) qty: number;
  // يُستعمل فقط لغير مرتجع الشراء — الافتراضي GOOD (يدخل الرصيد المتاح مباشرة)
  @IsOptional() @IsEnum(ReturnConditionEnum) condition?: ReturnConditionEnum;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsString() note?: string;
}

export class CreateReturnDto {
  @IsEnum(ReturnTypeEnum) returnType: ReturnTypeEnum;
  @IsString() @IsNotEmpty() warehouseId: string;
  @IsOptional() @IsString() purchaseInvoiceId?: string; // إلزامي فعلياً لمرتجع الشراء
  @IsOptional() @IsString() sourceReferenceType?: string;
  @IsOptional() @IsString() sourceReferenceId?: string;
  @IsOptional() @IsString() departmentId?: string;
  // مستودع التالف/الحجر — إذا لم يُرسل يُختار أول مستودع فعّال من نوع QUARANTINE تلقائياً
  @IsOptional() @IsString() damagedWarehouseId?: string;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items: ReturnItemInputDto[];
}
