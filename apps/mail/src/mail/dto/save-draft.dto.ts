import { IsString, IsArray, IsOptional, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecipientDto } from './send-mail.dto';

/**
 * المسودة تقبل كل الحقول فارغة عمداً: الواجهة تحفظ تلقائياً كل بضع ثوانٍ أثناء
 * الكتابة، فرفضُ مسودةٍ بلا موضوع أو بلا مستلم يعني ضياع ما كُتب. التحقق الإلزامي
 * يجري عند الإرسال وحده.
 */
export class SaveDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ type: [RecipientDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients?: RecipientDto[];

  @ApiPropertyOptional({ type: [String], description: 'أقسام تُوسَّع إلى مستلمين عند الإرسال' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH'], default: 'NORMAL' })
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  importance?: string;

  @ApiPropertyOptional({ type: [String], description: 'مرفقات مرفوعة مسبقاً تُربَط بالمسودة' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];

  @ApiPropertyOptional({ description: 'الرسالة التي تُجاوَب أو تُحوَّل' })
  @IsOptional()
  @IsString()
  parentMessageId?: string;

  @ApiPropertyOptional({ enum: ['REPLY', 'REPLY_ALL', 'FORWARD'] })
  @IsOptional()
  @IsIn(['REPLY', 'REPLY_ALL', 'FORWARD'])
  replyType?: string;
}
