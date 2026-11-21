import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * قرار مناسبة المقوّم للحالة.
 *
 * isSuitable إلزامي هنا: استدعاء هذا المسار **هو** اتخاذ القرار. و«لم يُقرَّر
 * بعد» تُمثَّل بعدم استدعائه أصلاً (تبقى القيمة null في قاعدة البيانات).
 */
export class SuitabilityDto {
  @IsBoolean()
  isSuitable: boolean;

  @IsOptional()
  @IsString()
  suitabilityNote?: string;

  /** عدد المقومات المستهدفة — صفر مسموح، والسالب مرفوض */
  @IsOptional()
  @IsInt()
  @Min(0)
  targetAppliancesCount?: number;
}
