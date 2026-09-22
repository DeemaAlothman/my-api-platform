import { IsString, IsOptional, IsBoolean, IsInt, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProbationCriteriaDto {
  @ApiProperty() @IsString() nameAr: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCore?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() targetEmployeeId?: string;
  // لو انبعت، السؤال بينربط تلقائياً بهالمسمى الوظيفي (بالإضافة للأسئلة الثابتة، مو بدل عنها) — للتوافق العكسي، استخدموا jobTitleIds بدلها
  @ApiPropertyOptional() @IsOptional() @IsString() jobTitleId?: string;
  // القائمة الكاملة للمسميات الوظيفية المرتبط فيها هالسؤال — PUT بيستبدل الربط بالكامل بهالقائمة
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) jobTitleIds?: string[];
}

export class JobTitleCriteriaDto {
  @ApiProperty({ type: [String] }) criteriaIds: string[];
}

export class SetJobTitleCriteriaEnabledDto {
  @ApiProperty() @IsBoolean() isEnabled: boolean;
}
