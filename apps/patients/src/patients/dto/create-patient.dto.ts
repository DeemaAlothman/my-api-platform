import { IsString, IsEnum, IsOptional, IsNumber, IsEmail, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum IdType { NATIONAL_ID = 'NATIONAL_ID', PASSPORT = 'PASSPORT', UNHCR = 'UNHCR', OTHER = 'OTHER' }
export enum Gender { MALE = 'MALE', FEMALE = 'FEMALE' }
export enum EducationLevel { ILLITERATE = 'ILLITERATE', PRIMARY = 'PRIMARY', SECONDARY = 'SECONDARY', HIGH_SCHOOL = 'HIGH_SCHOOL', UNIVERSITY = 'UNIVERSITY', POSTGRADUATE = 'POSTGRADUATE' }
export enum MaritalStatus { SINGLE = 'SINGLE', MARRIED = 'MARRIED', DIVORCED = 'DIVORCED', WIDOWED = 'WIDOWED' }
export enum LivingCondition { WITH_FAMILY = 'WITH_FAMILY', INDEPENDENT = 'INDEPENDENT', SHELTER_CAMP = 'SHELTER_CAMP', OTHER = 'OTHER' }
export enum FinancialStatus { LOW = 'LOW', MODERATE = 'MODERATE', GOOD = 'GOOD', NOT_WORKING = 'NOT_WORKING', RETIRED = 'RETIRED' }
export enum ReferralSource { SELF = 'SELF', RELATIVES = 'RELATIVES', SOCIAL_MEDIA = 'SOCIAL_MEDIA', MEDICAL_REFERRAL = 'MEDICAL_REFERRAL', OTHER = 'OTHER' }
export enum ConsentDecision { REFUSED = 'REFUSED', FUNDER_ONLY = 'FUNDER_ONLY', FUNDER_AND_SOCIAL = 'FUNDER_AND_SOCIAL' }

export class CreatePatientDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsEnum(IdType) idType: IdType;
  @IsString() idNumber: string;
  @IsDateString() dateOfBirth: string;
  @IsEnum(Gender) gender: Gender;

  @Type(() => Number) @IsNumber() cityId: number;
  @IsOptional() @IsString() addressDetails?: string;
  @IsOptional() @IsString() currentAddress?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsString() phone: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;

  @IsOptional() @IsString() occupation?: string;

  @IsOptional() @Type(() => Number) @IsNumber() heightCm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() weightKg?: number;

  @IsOptional() @IsEnum(EducationLevel) educationLevel?: EducationLevel;
  @IsOptional() @IsEnum(MaritalStatus) maritalStatus?: MaritalStatus;
  @IsOptional() @IsEnum(LivingCondition) livingCondition?: LivingCondition;
  @IsOptional() @IsEnum(FinancialStatus) financialStatus?: FinancialStatus;
  @IsOptional() @IsString() receivesAid?: string; // اسم الجهة/المساعدة (نص)

  @IsOptional() @IsEnum(ReferralSource) referralSource?: ReferralSource;
  @IsOptional() @IsString() referralDetails?: string;

  // موافقة التوثيق — اختيارية عند إنشاء المريض
  @IsOptional() @IsEnum(ConsentDecision) consentDecision?: ConsentDecision;
  @IsOptional() @IsString() consentSignedByPatient?: string;
  @IsOptional() @IsString() consentSignatureBase64?: string;
  @IsOptional() @IsDateString() consentSignedAt?: string;
}
