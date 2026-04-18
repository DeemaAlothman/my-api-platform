import { IsEmail, IsEnum, IsOptional, IsString, IsDateString, IsUUID, IsNumber, IsInt, IsBoolean, Min, Max, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, MaritalStatus, ContractType, BloodType, EducationLevel, EmployeeAttachmentDto, TrainingCertificateDto, EmployeeAllowanceDto, ProbationPeriod, InterviewEvaluation, WorkType } from './create-employee.dto';

export enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  firstNameAr?: string;

  @IsOptional()
  @IsString()
  lastNameAr?: string;

  @IsOptional()
  @IsString()
  firstNameEn?: string;

  @IsOptional()
  @IsString()
  lastNameEn?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus | null;

  @IsOptional()
  @IsBoolean()
  hasDrivingLicense?: boolean;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  jobTitleId?: string;

  @IsOptional()
  @IsUUID()
  jobGradeId?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsString()
  fingerprintId?: string;

  @IsOptional()
  @IsEnum(WorkType)
  workType?: WorkType | null;

  @IsOptional()
  @IsEnum(ProbationPeriod)
  probationPeriod?: ProbationPeriod | null;

  @IsOptional()
  @IsEnum(InterviewEvaluation)
  interviewEvaluation?: InterviewEvaluation | null;

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
  bloodType?: BloodType | null;

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
  educationLevel?: EducationLevel | null;

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
  university1?: string;

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
  university2?: string;

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
