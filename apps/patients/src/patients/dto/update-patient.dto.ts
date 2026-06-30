import { IsString, IsEnum, IsOptional, IsNumber, IsEmail, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { IdType, Gender, EducationLevel, MaritalStatus, LivingCondition, FinancialStatus, ReferralSource } from './create-patient.dto';

// مطابق لـ CreatePatientDto لكن كل الحقول اختيارية — كلاس حقيقي (وليس Partial<> النوعي وقت الترجمة)
// حتى تشتغل whitelist بالـValidationPipe وتُسقط أي حقل غريب غير معرّف هون قبل ما يوصل لـ Prisma
export class UpdatePatientDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEnum(IdType) idType?: IdType;
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;

  @IsOptional() @Type(() => Number) @IsNumber() cityId?: number;
  @IsOptional() @IsString() addressDetails?: string;
  @IsOptional() @IsString() currentAddress?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;

  @IsOptional() @IsString() occupation?: string;

  @IsOptional() @Type(() => Number) @IsNumber() heightCm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() weightKg?: number;

  @IsOptional() @IsEnum(EducationLevel) educationLevel?: EducationLevel;
  @IsOptional() @IsEnum(MaritalStatus) maritalStatus?: MaritalStatus;
  @IsOptional() @IsEnum(LivingCondition) livingCondition?: LivingCondition;
  @IsOptional() @IsEnum(FinancialStatus) financialStatus?: FinancialStatus;
  @IsOptional() @IsString() receivesAid?: string;

  @IsOptional() @IsEnum(ReferralSource) referralSource?: ReferralSource;
  @IsOptional() @IsString() referralDetails?: string;
}
