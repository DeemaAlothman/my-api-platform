import { IsIn, IsNumber, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export const INSOLE_COST_CURRENCIES = ['USD', 'SYP'];
export const INSOLE_COST_NOTE_MAX = 200;

// الحقول الثلاثة مستقلة: الحقل الغائب ما بيتغيّر، و null بيمسحه لحاله.
// قواعد الترابط (العملة مع المبلغ، والطلب الفاضي) بتنفحص بالـ controller.
export class UpdateInsoleCostDto {
  // تكلفة الضبان لهذا التركيب. null تمسح المبلغ والعملة معاً (النص يبقى).
  @ValidateIf((o) => o.insoleCost !== null && o.insoleCost !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'تكلفة الضبان يجب أن تكون رقماً بمنزلتين عشريتين كحد أقصى' })
  @Min(0, { message: 'تكلفة الضبان لا يمكن أن تكون أقل من صفر' })
  insoleCost?: number | null;

  // العملة إجبارية مع أي مبلغ رقمي فقط؛ النص لحاله ما بيحتاج عملة.
  @ValidateIf((o) => o.insoleCostCurrency !== null && o.insoleCostCurrency !== undefined)
  @IsIn(INSOLE_COST_CURRENCIES, { message: 'عملة التكلفة يجب أن تكون USD أو SYP' })
  insoleCostCurrency?: string | null;

  // نص اختياري جنب المبلغ (مثلاً «هدية») — ما بيدخل بأي مجموع. null أو نص فاضي يمسحه.
  @ValidateIf((o) => o.insoleCostNote !== null && o.insoleCostNote !== undefined)
  @IsString({ message: 'ملاحظة التكلفة يجب أن تكون نصاً' })
  @MaxLength(INSOLE_COST_NOTE_MAX, { message: `ملاحظة التكلفة لا تتجاوز ${INSOLE_COST_NOTE_MAX} حرفاً` })
  insoleCostNote?: string | null;
}
