import { IsOptional, IsString, IsNumber, IsEnum, IsIn, IsBoolean, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Gender, EducationLevel, ReferralSource } from './create-patient.dto';

export class ListPatientsQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsNumber() cityId?: number;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsEnum(EducationLevel) educationLevel?: EducationLevel;
  // طريقة وصول المريض. @IsEnum يرفض قيمة غير معروفة بـ400 بدل تمريرها إلى
  // Prisma حيث تصير خطأ خام غير مفهوم للواجهة.
  @IsOptional() @IsEnum(ReferralSource) referralSource?: ReferralSource;
  @IsOptional() @IsString() governorate?: string;
  @IsOptional() @IsString() documentConsent?: string;
  @IsOptional() @IsString() consentDecision?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsIn(['physio', 'prosthetics', 'podiatry', 'doctor_exam']) caseType?: string;
  @IsOptional() @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true)) @IsBoolean() isCompanyPatient?: boolean;
}
