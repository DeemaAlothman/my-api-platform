import { IsOptional, IsString, IsNumber, IsDateString, IsIn, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { AllowanceType, CommissionItemDto } from './create-employee.dto';

// بدل واحد (نوع + قيمة) — نفس بدلات إنشاء الموظف
export class AllowanceInputDto {
  @IsEnum(AllowanceType) type: AllowanceType;
  @Type(() => Number) @IsNumber() amount: number;
}

// نقل/تغيير وظيفي: قسم و/أو منصب و/أو درجة و/أو مدير و/أو راتب الأساسي — كلها اختيارية،
// بس لازم يتغيّر شي واحد على الأقل. يُسجَّل حدث TRANSFER بالإضبارة.
export class TransferEmployeeDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() jobTitleId?: string;
  @IsOptional() @IsString() jobGradeId?: string;
  @IsOptional() @IsString() managerId?: string;

  @IsOptional() @Type(() => Number) @IsNumber() basicSalary?: number;
  @IsOptional() @IsString() salaryCurrency?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceInputDto)
  allowances?: AllowanceInputDto[];

  @IsDateString() effectiveDate: string;
  @IsOptional() @IsString() note?: string;
}

// تغيير راتب مستقل (مع تمييز اختياري إذا كان ترقية) + بدلات اختيارية.
export class ChangeSalaryDto {
  @Type(() => Number) @IsNumber() basicSalary: number;
  @IsOptional() @IsString() salaryCurrency?: string;

  // البدلات: إذا أُرسلت، تستبدل بدلات الموظف بالكامل
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceInputDto)
  allowances?: AllowanceInputDto[];

  @IsOptional() @IsIn(['SALARY_CHANGE', 'PROMOTION']) eventType?: 'SALARY_CHANGE' | 'PROMOTION';

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CommissionItemDto)
  commissions?: CommissionItemDto[];

  @IsDateString() effectiveDate: string;
  @IsOptional() @IsString() note?: string;
}
