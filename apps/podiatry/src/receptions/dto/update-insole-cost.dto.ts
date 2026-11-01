import { IsIn, IsNumber, Min, ValidateIf } from 'class-validator';

export const INSOLE_COST_CURRENCIES = ['USD', 'SYP'];

export class UpdateInsoleCostDto {
  // تكلفة الضبان لهذا التركيب. يُقبل null صراحةً لمسح القيمة،
  // أما غياب الحقل نهائياً فمرفوض (400) حتى لا يُمسح المبلغ بالغلط.
  @ValidateIf((o) => o.insoleCost !== null)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'تكلفة الضبان يجب أن تكون رقماً بمنزلتين عشريتين كحد أقصى' })
  @Min(0, { message: 'تكلفة الضبان لا يمكن أن تكون أقل من صفر' })
  insoleCost!: number | null;

  // العملة إجبارية مع أي تكلفة رقمية: غيابها أو قيمة خارج USD/SYP ترفض الطلب بـ 400.
  // مع insoleCost: null تُتجاهل، لأن المسح يشمل المبلغ والعملة معاً.
  @ValidateIf((o) => o.insoleCost !== null && o.insoleCost !== undefined)
  @IsIn(INSOLE_COST_CURRENCIES, { message: 'عملة التكلفة يجب أن تكون USD أو SYP' })
  insoleCostCurrency!: string | null;
}
