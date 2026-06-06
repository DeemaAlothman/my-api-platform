import { IsOptional, IsString, IsNumber, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

// نقل/تغيير وظيفي: قسم و/أو منصب و/أو درجة و/أو مدير و/أو راتب — كلها اختيارية،
// بس لازم يتغيّر شي واحد على الأقل. يُسجَّل حدث TRANSFER بالإضبارة.
export class TransferEmployeeDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() jobTitleId?: string;
  @IsOptional() @IsString() jobGradeId?: string;
  @IsOptional() @IsString() managerId?: string;

  @IsOptional() @Type(() => Number) @IsNumber() basicSalary?: number;
  @IsOptional() @IsString() salaryCurrency?: string;

  @IsDateString() effectiveDate: string;
  @IsOptional() @IsString() note?: string;
}

// تغيير راتب مستقل (مع تمييز اختياري إذا كان ترقية).
export class ChangeSalaryDto {
  @Type(() => Number) @IsNumber() basicSalary: number;
  @IsOptional() @IsString() salaryCurrency?: string;

  @IsOptional() @IsIn(['SALARY_CHANGE', 'PROMOTION']) eventType?: 'SALARY_CHANGE' | 'PROMOTION';

  @IsDateString() effectiveDate: string;
  @IsOptional() @IsString() note?: string;
}
