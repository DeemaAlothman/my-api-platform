import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class ProsthetistOpinionDto {
  // recommendedDeviceTypes: AFO | KAFO | ORTHOSIS_WITH_FES | OTHER
  @IsOptional() @IsArray() @IsString({ each: true }) recommendedDeviceTypes?: string[];
  @IsOptional() @IsString() recommendedDeviceOther?: string;
  // ملاحظات إضافية / الحالات التي تستدعي الانتباه
  @IsOptional() @IsString() additionalNotes?: string;

  // عدد الأجهزة المطلوبة من كل نوع — { AFO: 2, KAFO: 1 }. يستبدل الكائن القديم بالكامل،
  // والمفتاح الغائب يُعتبر 0. مفاتيح مسموحة فقط: AFO | KAFO | ORTHOSIS_WITH_FES | OTHER
  @IsOptional() @IsObject() deviceUsageCounts?: Record<string, number>;

  @IsOptional() @IsString() prosthetistOpinion?: string;
}
