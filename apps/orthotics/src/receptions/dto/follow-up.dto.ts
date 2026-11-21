import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** جلسة متابعة للمقومات — على نمط متابعات الأطراف الصناعية */
export class OrthoticsFollowUpDto {
  @IsDateString()
  visitDate: string;

  @IsString()
  @IsNotEmpty({ message: 'findings مطلوب — ما لوحظ في الجلسة' })
  findings: string;

  @IsOptional()
  @IsString()
  actions?: string;

  /** المعالج — يُؤخذ من المستخدم الحالي إن لم يُرسَل */
  @IsOptional()
  @IsString()
  practitionerId?: string;
}
