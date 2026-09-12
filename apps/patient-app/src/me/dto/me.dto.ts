import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CompleteExerciseDto {
  @IsOptional() @IsString() completionNote?: string;
}

export class SkipExerciseDto {
  @IsOptional() @IsUUID() skipReasonId?: string;
  @IsOptional() @IsString() skipReasonText?: string;
}
