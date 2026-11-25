import { IsString, IsOptional, IsIn, IsNotEmpty } from 'class-validator';

// قطعة من كتالوج المستودع، أو قطعة مكتوبة يدوياً. الأولى يكفيها معرّف الصنف —
// يُقرأ منه الكود والاسم — والثانية يلزمها الاثنان معاً.
export class AddComponentDto {
  @IsOptional() @IsString()
  warehouseItemId?: string;

  // المستودع الذي يُفتح عليه طلب المواد؛ بدونه يُستعمل المستودع الرئيسي
  @IsOptional() @IsString()
  warehouseId?: string;

  @IsOptional() @IsString() @IsNotEmpty()
  partCode?: string;

  @IsOptional() @IsString() @IsNotEmpty()
  partName?: string;

  @IsString() @IsNotEmpty()
  supplier: string;

  @IsIn(['WAREHOUSE', 'EXTERNAL'])
  sourceLocation: string;
}
