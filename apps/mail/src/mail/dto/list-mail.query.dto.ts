import { IsOptional, IsInt, Min, Max, IsString, IsDateString, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * كل باراميتر هنا **لا بد** أن يكون معرّفاً في هذا الملف: الخدمة تعمل بـ
 * `whitelist: true`، فأي باراميتر غير معرَّف يُحذف من الطلب بصمت ويعود الرد
 * ناجحاً بلا فلترة — وهو عطل يصعب تشخيصه من الواجهة.
 */
const toBool = ({ value }: { value: any }) =>
  value === undefined || value === '' ? undefined : value === 'true' || value === true;

export class ListMailQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'يشمل الموضوع والنص (بلا وسوم) واسم المرسِل وأسماء المرفقات' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Archive folder ID — used only for archive endpoint' })
  @IsOptional()
  @IsString()
  archiveFolderId?: string;

  @ApiPropertyOptional({ description: 'false = غير المقروءة فقط' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({ description: 'true = الرسائل التي تحمل مرفقات فقط' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  hasAttachments?: boolean;

  @ApiPropertyOptional({ description: 'true = المُعلَّمة بنجمة فقط' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isStarred?: boolean;

  @ApiPropertyOptional({ description: 'employeeId للمرسِل — يُحوَّل داخلياً إلى userId' })
  @IsOptional()
  @IsString()
  senderId?: string;
}
