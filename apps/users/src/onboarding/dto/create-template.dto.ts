import { IsString, IsEnum, IsBoolean, IsOptional, IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum WorkflowType { ONBOARDING = 'ONBOARDING', OFFBOARDING = 'OFFBOARDING' }
enum TaskAssignee { HR = 'HR', IT = 'IT', MANAGER = 'MANAGER', EMPLOYEE = 'EMPLOYEE', OTHER = 'OTHER' }

export class CreateTemplateTaskDto {
  @ApiProperty() @IsString() titleAr: string;
  @ApiProperty() @IsString() titleEn: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionEn?: string;
  @ApiProperty({ enum: TaskAssignee }) @IsEnum(TaskAssignee) assignedTo: TaskAssignee;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) daysFromStart?: number;
}

export class CreateTemplateDto {
  @ApiProperty({ enum: WorkflowType }) @IsEnum(WorkflowType) type: WorkflowType;
  @ApiProperty() @IsString() nameAr: string;
  @ApiProperty() @IsString() nameEn: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiProperty({ type: [CreateTemplateTaskDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateTemplateTaskDto)
  tasks: CreateTemplateTaskDto[];
}
