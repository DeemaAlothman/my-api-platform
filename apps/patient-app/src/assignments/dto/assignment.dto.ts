import { IsArray, IsInt, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssignmentDto {
  @IsUUID() exerciseId: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsInt() durationSeconds: number;
  @IsOptional() @IsInt() sets?: number;
  @IsOptional() @IsInt() reps?: number;
  @IsOptional() @IsInt() holdSeconds?: number;
  @IsOptional() @IsInt() restSeconds?: number;
  @IsOptional() @IsString() frequencyTextAr?: string;
  @IsOptional() @IsString() frequencyTextEn?: string;
  @IsOptional() @IsString() customInstructionAr?: string;
  @IsOptional() @IsString() customInstructionEn?: string;
}

export class UpdateAssignmentDto {
  @IsOptional() @IsInt() durationSeconds?: number;
  @IsOptional() @IsInt() sets?: number;
  @IsOptional() @IsInt() reps?: number;
  @IsOptional() @IsInt() holdSeconds?: number;
  @IsOptional() @IsInt() restSeconds?: number;
  @IsOptional() @IsString() frequencyTextAr?: string;
  @IsOptional() @IsString() frequencyTextEn?: string;
  @IsOptional() @IsString() customInstructionAr?: string;
  @IsOptional() @IsString() customInstructionEn?: string;
}

export class CancelAssignmentDto {
  @IsOptional() @IsString() reason?: string;
}

class ReorderItemDto {
  @IsUUID() id: string;
  @IsInt() sortOrder: number;
}

export class ReorderAssignmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
