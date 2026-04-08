import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsUUID, IsNumber, IsInt, IsBoolean, Min, Max, ValidateNested, IsArray, IsDecimal } from 'class-validator';
import { Type } from 'class-transformer';


export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum MaritalStatus {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED',
}

export enum ContractType {
  FIXED_TERM = 'FIXED_TERM',
  INDEFINITE = 'INDEFINITE',
  TEMPORARY = 'TEMPORARY',
  TRAINEE = 'TRAINEE',
}

export enum AllowanceType {
  FOOD = 'FOOD',
  PREVIOUS_EXPERIENCE = 'PREVIOUS_EXPERIENCE',
  ACADEMIC_DEGREE = 'ACADEMIC_DEGREE',
  WORK_NATURE = 'WORK_NATURE',
  RESPONSIBILITY = 'RESPONSIBILITY',
  RESIDENCE = 'RESIDENCE',
}

export class EmployeeAllowanceDto {
  @IsNotEmpty()
  @IsEnum(AllowanceType)
  type: AllowanceType;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0)
  amount: number;
}

export class TrainingCertificateDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

export enum BloodType {
  A_POSITIVE = 'A_POSITIVE',
  A_NEGATIVE = 'A_NEGATIVE',
  B_POSITIVE = 'B_POSITIVE',
  B_NEGATIVE = 'B_NEGATIVE',
  AB_POSITIVE = 'AB_POSITIVE',
  AB_NEGATIVE = 'AB_NEGATIVE',
  O_POSITIVE = 'O_POSITIVE',
  O_NEGATIVE = 'O_NEGATIVE',
}

export enum EducationLevel {
  ILLITERATE = 'ILLITERATE',
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  DIPLOMA = 'DIPLOMA',
  UNIVERSITY = 'UNIVERSITY',
  POSTGRADUATE = 'POSTGRADUATE',
}

export enum ProbationPeriod {
  ONE_MONTH = 'ONE_MONTH',
  TWO_MONTHS = 'TWO_MONTHS',
  THREE_MONTHS = 'THREE_MONTHS',
}

export enum InterviewEvaluation {
  EXCELLENT = 'EXCELLENT',
  VERY_GOOD = 'VERY_GOOD',
  GOOD = 'GOOD',
  ACCEPTABLE = 'ACCEPTABLE',
  POOR = 'POOR',
}

export class EmployeeAttachmentDto {
  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @IsNotEmpty()
  @IsString()
  fileName: string;
}

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  employeeNumber?: string; // auto-generated if not provided

  @IsNotEmpty({ message: 'First name (Arabic) is required' })
  @IsString()
  firstNameAr: string;

  @IsNotEmpty({ message: 'Last name (Arabic) is required' })
  @IsString()
  lastNameAr: string;

  @IsOptional()
  @IsString()
  firstNameEn?: string;

  @IsOptional()
  @IsString()
  lastNameEn?: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsNotEmpty({ message: 'Gender is required' })
  @IsEnum(Gender, { message: 'Gender must be MALE or FEMALE' })
  gender: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsBoolean()
  hasDrivingLicense?: boolean;

  @IsNotEmpty({ message: 'Department is required' })
  @IsUUID()
  departmentId: string;

  @IsOptional()
  @IsUUID()
  jobTitleId?: string;

  @IsOptional()
  @IsUUID()
  jobGradeId?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsNotEmpty({ message: 'Hire date is required' })
  @IsDateString()
  hireDate: string;

  @IsNotEmpty({ message: 'Contract type is required' })
  @IsEnum(ContractType)
  contractType: ContractType;

  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @IsOptional()
  @IsString()
  fingerprintId?: string;

  @IsOptional()
  @IsEnum(ProbationPeriod)
  probationPeriod?: ProbationPeriod;

  @IsOptional()
  @IsEnum(InterviewEvaluation)
  interviewEvaluation?: InterviewEvaluation;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Basic salary must be a number' })
  @Min(0)
  basicSalary?: number;

  @IsOptional()
  @IsString()
  salaryCurrency?: string;

  // Personal Info (extra)
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  familyMembersCount?: number;

  @IsOptional()
  @IsString()
  chronicDiseases?: string;

  @IsOptional()
  @IsString()
  currentAddress?: string;

  @IsOptional()
  @IsBoolean()
  isSmoker?: boolean;

  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  @Type(() => Number)
  universityYear?: number;

  @IsOptional()
  @IsString()
  religion?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmployeeAttachmentDto)
  attachments?: EmployeeAttachmentDto[];

  // Education & Experience
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  yearsOfExperience?: number;

  @IsOptional()
  @IsString()
  certificate1?: string;

  @IsOptional()
  @IsString()
  specialization1?: string;

  @IsOptional()
  @IsString()
  certificateAttachment1?: string;

  @IsOptional()
  @IsString()
  certificate2?: string;

  @IsOptional()
  @IsString()
  specialization2?: string;

  @IsOptional()
  @IsString()
  certificateAttachment2?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrainingCertificateDto)
  trainingCertificates?: TrainingCertificateDto[];

  // Allowances
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmployeeAllowanceDto)
  allowances?: EmployeeAllowanceDto[];
}
