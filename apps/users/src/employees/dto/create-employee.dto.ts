import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';

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
  PERMANENT = 'PERMANENT',
  TEMPORARY = 'TEMPORARY',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
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

  @IsNotEmpty({ message: 'Department is required' })
  @IsUUID()
  departmentId: string;

  @IsOptional()
  @IsUUID()
  jobTitleId?: string;

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
}
