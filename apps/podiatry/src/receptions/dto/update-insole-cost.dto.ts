import { IsNumber, Min, ValidateIf } from 'class-validator';

export class UpdateInsoleCostDto {
  // تكلفة الضبان لهذا التركيب. يُقبل null صراحةً لمسح القيمة،
  // أما غياب الحقل نهائياً فمرفوض (400) حتى لا يُمسح المبلغ بالغلط.
  @ValidateIf((o) => o.insoleCost !== null)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'تكلفة الضبان يجب أن تكون رقماً بمنزلتين عشريتين كحد أقصى' })
  @Min(0, { message: 'تكلفة الضبان لا يمكن أن تكون أقل من صفر' })
  insoleCost!: number | null;
}
