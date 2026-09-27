import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialRequestItemInputDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0.001) requestedQty: number;
}

export class CreateMaterialRequestDto {
  @IsString() @IsNotEmpty() warehouseId: string;
  @IsOptional() @IsString() referenceType?: string; // افتراضياً MANUAL — PROSTHETICS_CASE لاحقاً
  @IsOptional() @IsString() referenceId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialRequestItemInputDto)
  items: MaterialRequestItemInputDto[];
}

export class ApproveItemInputDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0) approvedQty: number;
}

export class ApproveMaterialRequestDto {
  // إذا لم تُرسل items، يُعتمد كامل requestedQty لكل بند (مقيَّد بالمتاح فعلياً)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApproveItemInputDto)
  items?: ApproveItemInputDto[];
}

export class RejectMaterialRequestDto {
  @IsOptional() @IsString() reason?: string;
}

export class IssueItemInputDto {
  @IsString() @IsNotEmpty() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0.001) issuedQty: number;
}

export class IssueMaterialRequestDto {
  // إذا لم تُرسل items، يُصرف كامل المتبقي من approvedQty لكل بند
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueItemInputDto)
  items?: IssueItemInputDto[];
}
