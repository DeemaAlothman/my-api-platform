import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProbationCriteriaDto {
  @ApiProperty() @IsString() nameAr: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCore?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() targetEmployeeId?: string;
  // لو انبعت، السؤال بينربط تلقائياً بهالمسمى الوظيفي (بالإضافة للأسئلة الثابتة، مو بدل عنها)
  @ApiPropertyOptional() @IsOptional() @IsString() jobTitleId?: string;
}

export class JobTitleCriteriaDto {
  @ApiProperty({ type: [String] }) criteriaIds: string[];
}

export class SetJobTitleCriteriaEnabledDto {
  @ApiProperty() @IsBoolean() isEnabled: boolean;
}
