import {
  IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ملاحظة: ValidationPipe بالخدمة مضبوط على skipMissingProperties — الحقول الإلزامية
// تُتحقق يدوياً بالخدمة أيضاً.

export class CreateCycleDto {
  @IsString() @MaxLength(50) code: string;
  @IsString() @MaxLength(200) nameAr: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

export class UpdateCycleDto {
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class AnswerDto {
  @IsString() questionId: string;
  @IsInt() @Min(1) @Max(10) score: number;
}

export class SaveSubmissionDto {
  @IsIn(['MANAGER', 'PEER', 'UPWARD', 'SELF']) axis: string;
  @IsString() evaluateeId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => AnswerDto) answers: AnswerDto[];
  @IsOptional() @IsString() @MaxLength(5000) comments?: string;
  @IsOptional() @IsString() @MaxLength(10000) achievementNote?: string;
}

export class UpdateSettingsDto {
  @IsOptional() @IsNumber() @Min(0) penaltyPoints?: number;
  @IsOptional() @IsNumber() @Min(0) justificationPoints?: number;
  @IsOptional() @IsNumber() @Min(0) excessLeaveDayPoints?: number;
  @IsOptional() @IsNumber() @Min(0) excessLeaveHourPoints?: number;
  @IsOptional() @IsNumber() @Min(0) starOfMonthPoints?: number;
  @IsOptional() @IsNumber() @Min(0) monthlyLeaveDaysAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) monthlyLeaveHoursAllowance?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) countedLeaveTypeCodes?: string[];
}

export class SetDepartmentConfigDto {
  /** null = قسم إداري خارج المركز */
  @IsOptional() @IsIn(['PROSTHETICS', 'PHYSIO', 'PODIATRY', null]) satisfactionSource?: string | null;
}

export class SetReadinessJobTitlesDto {
  @IsArray() @IsString({ each: true }) jobTitleIds: string[];
}
