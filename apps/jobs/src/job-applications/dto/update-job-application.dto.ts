import { IsString, IsOptional, IsNumber, IsIn, IsDateString, Min, Max, ValidateIf } from 'class-validator';

/**
 * حالات طلب التوظيف كما يقبلها نظام VitaSyr الخارجي.
 *
 * ACCEPTED قديمة: ما زالت مقبولة عند الطرف الخارجي للتوافق مع سجلات سابقة،
 * لكنها خارج التدفّق الجديد فلا نسمح بها هنا.
 */
export const APPLICATION_STATUSES = [
  'PENDING',
  'INTERVIEW_READY',
  'INTERVIEWED',
  'PENDING_CEO_APPROVAL',
  'RETURNED_TO_HR',
  'HIRED',
  'REJECTED',
] as const;

export class UpdateJobApplicationDto {
  @IsString()
  @IsIn([...APPLICATION_STATUSES])
  status: string;

  @IsOptional()
  @IsString()
  reviewNotes?: string;

  /** إجباري عند REJECTED */
  @ValidateIf((o) => o.status === 'REJECTED')
  @IsString({ message: 'rejectionNote مطلوب عند الرفض' })
  rejectionNote?: string;

  /** للتوافق مع الاستخدام القديم — غير مستعمل في التدفّق الجديد */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  // ── الشروط المعروضة على المتقدّم ──────────────────────────────────────────
  // تُرسَل عند الإحالة إلى المدير التنفيذي، وتُعدَّل عند إعادة الإرسال بعد رفضه.

  @IsOptional()
  @IsString()
  offeredJobTitle?: string;

  /** نص لا رقم: قد يكون "500 USD" أو مجالاً أو "حسب الخبرة" */
  @IsOptional()
  @IsString()
  offeredSalary?: string;

  @IsOptional()
  @IsDateString()
  offeredStartDate?: string;

  @IsOptional()
  @IsString()
  ceoNote?: string;
}

/** رفض المدير التنفيذي — يعيد الطلب إلى الموارد البشرية لا إلى الرفض النهائي */
export class CeoRejectDto {
  @IsString({ message: 'ceoNote مطلوب — سبب الإعادة إلى الموارد البشرية' })
  ceoNote: string;
}
