import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsBoolean, IsIn, Matches } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export const CASH_TRANSACTION_STATUSES = [
  'COMPLETED', 'PENDING_CEO_APPROVAL', 'PENDING_RECEIPT', 'REJECTED', 'CANCELLED',
] as const;

export class DisbursementDto {
  @IsString() @IsNotEmpty() cashBoxId: string;
  @IsString() @IsNotEmpty() targetEmployeeId: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() currencyId: string;
  @IsString() @IsNotEmpty() reason: string;

  // غيابُه تنفيذٌ فوري كما كان قبل هذا الحقل، فلا يتبدَّل سلوكُ ما لا يُرسِله
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  requiresCeoApproval?: boolean;
}

// سببُ الرفض إلزامي: رفضٌ بلا سببٍ لا يُفيد من يُراجعه بعد شهر
export class RejectDto {
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

// إيداع/رصيد افتتاحي — رأس مال خارجي بدون مريض أو زبون، صلاحية خاصة (cashbox.transactions.deposit)
export class DepositDto {
  @IsString() @IsNotEmpty() cashBoxId: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() currencyId: string;
  @IsString() @IsNotEmpty() reason: string;
}

export class ListTransactionsQueryDto {
  @IsOptional() @IsString() cashBoxId?: string;
  @IsOptional() @IsString() transactionType?: string;
  // حالةٌ غير معروفة تُرفَض ولا تُهمَل: فلترةٌ مُهمَلةٌ بصمتٍ تُرجِع كلَّ شيء
  // فيَحسَبها القارئُ نتيجةً صحيحة
  @IsOptional() @IsIn(CASH_TRANSACTION_STATUSES as unknown as string[]) status?: string;

  // يومٌ بصيغة YYYY-MM-DD، والطرفان داخلان. والصيغةُ تُفحَص هنا لا تُمرَّر كما جاءت:
  // نصٌّ ليس تاريخاً يصنع مدىً غيرَ صالحٍ يَرفضه المحرِّكُ برسالةٍ لا تَدلُّ على سببه.
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom لازم تكون بصيغة YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo لازم تكون بصيغة YYYY-MM-DD' })
  dateTo?: string;

  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}
