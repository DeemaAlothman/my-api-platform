import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsEmail, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

// يقبل boolean أو نص ("true"/"false"/"1"/"0"/"نعم"/"لا") ويحوّله boolean (للفورم/الـ form-data)
const toBoolean = ({ value }: { value: any }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['true', '1', 'yes', 'نعم'].includes(value.trim().toLowerCase());
  return value;
};

export enum IdType { NATIONAL_ID = 'NATIONAL_ID', PASSPORT = 'PASSPORT', UNHCR = 'UNHCR', OTHER = 'OTHER' }
export enum Gender { MALE = 'MALE', FEMALE = 'FEMALE' }
export enum EducationLevel { ILLITERATE = 'ILLITERATE', PRIMARY = 'PRIMARY', SECONDARY = 'SECONDARY', HIGH_SCHOOL = 'HIGH_SCHOOL', UNIVERSITY = 'UNIVERSITY', POSTGRADUATE = 'POSTGRADUATE' }
export enum MaritalStatus { SINGLE = 'SINGLE', MARRIED = 'MARRIED', DIVORCED = 'DIVORCED', WIDOWED = 'WIDOWED' }
export enum LivingCondition { WITH_FAMILY = 'WITH_FAMILY', INDEPENDENT = 'INDEPENDENT', SHELTER_CAMP = 'SHELTER_CAMP', OTHER = 'OTHER' }
export enum FinancialStatus { LOW = 'LOW', MODERATE = 'MODERATE', GOOD = 'GOOD', NOT_WORKING = 'NOT_WORKING', RETIRED = 'RETIRED' }
export enum ReferralSource { SELF = 'SELF', RELATIVES = 'RELATIVES', SOCIAL_MEDIA = 'SOCIAL_MEDIA', MEDICAL_REFERRAL = 'MEDICAL_REFERRAL', OTHER = 'OTHER' }

export class CreatePatientDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsEnum(IdType) idType: IdType;
  @IsString() idNumber: string;
  @IsDateString() dateOfBirth: string;
  @IsEnum(Gender) gender: Gender;

  @Type(() => Number) @IsNumber() cityId: number;
  @IsOptional() @IsString() addressDetails?: string;
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
  @IsOptional() @Transform(toBoolean) @IsBoolean() receivesAid?: boolean;

  @IsOptional() @IsEnum(ReferralSource) referralSource?: ReferralSource;
  @IsOptional() @IsString() referralDetails?: string;
}
