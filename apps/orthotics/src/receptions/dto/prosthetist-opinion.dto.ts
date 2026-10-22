import { IsString, IsOptional, IsArray } from 'class-validator';

export class ProsthetistOpinionDto {
  // recommendedDeviceTypes: AFO | KAFO | ORTHOSIS_WITH_FES | OTHER
  @IsOptional() @IsArray() @IsString({ each: true }) recommendedDeviceTypes?: string[];
  @IsOptional() @IsString() recommendedDeviceOther?: string;
  // ملاحظات إضافية / الحالات التي تستدعي الانتباه
  @IsOptional() @IsString() additionalNotes?: string;

  @IsOptional() @IsString() prosthetistOpinion?: string;
}
