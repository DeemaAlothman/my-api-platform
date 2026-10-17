import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ProsthetistOpinionDto {
  // recommendedDeviceTypes: AFO | KAFO | ORTHOSIS_WITH_FES | OTHER
  @IsOptional() @IsArray() @IsString({ each: true }) recommendedDeviceTypes?: string[];
  @IsOptional() @IsString() recommendedDeviceOther?: string;
  // مدة الاستخدام اليومية بالساعات
  @IsOptional() @IsNumber() @Type(() => Number) dailyWearHours?: number;
  // ملاحظات إضافية / الحالات التي تستدعي الانتباه
  @IsOptional() @IsString() additionalNotes?: string;

  @IsOptional() @IsString() prosthetistOpinion?: string;
}
