import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum WorkflowType { ONBOARDING = 'ONBOARDING', OFFBOARDING = 'OFFBOARDING' }

export class CreateWorkflowDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiProperty() @IsString() templateId: string;
  @ApiProperty({ enum: WorkflowType }) @IsEnum(WorkflowType) type: WorkflowType;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() targetDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
