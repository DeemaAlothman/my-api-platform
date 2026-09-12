import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

enum MediaTypeDto { VIDEO = 'VIDEO', IMAGE = 'IMAGE', ANIMATION = 'ANIMATION' }

export class CreateExerciseDto {
  @IsString() nameAr: string;
  @IsString() nameEn: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsString() descriptionEn?: string;

  @IsUUID() bodyRegionId: string;
  @IsUUID() targetRegionId: string;
  @IsOptional() @IsUUID() subTargetRegionId?: string;

  @IsEnum(MediaTypeDto) mediaType: MediaTypeDto;
  @IsOptional() @IsString() mediaUrl?: string;
  @IsOptional() @IsString() thumbnailUrl?: string;

  @IsOptional() @IsString() executionMethodAr?: string;
  @IsOptional() @IsString() executionMethodEn?: string;
  @IsOptional() @IsString() warningsAr?: string;
  @IsOptional() @IsString() warningsEn?: string;
  @IsOptional() @IsString() commonMistakesAr?: string;
  @IsOptional() @IsString() commonMistakesEn?: string;

  @IsOptional() @IsInt() defaultDurationSeconds?: number;

  @IsOptional() @IsArray() @IsUUID('4', { each: true }) goalIds?: string[];
}

export class UpdateExerciseDto {
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsString() descriptionEn?: string;

  @IsOptional() @IsUUID() bodyRegionId?: string;
  @IsOptional() @IsUUID() targetRegionId?: string;
  @IsOptional() @IsUUID() subTargetRegionId?: string;

  @IsOptional() @IsEnum(MediaTypeDto) mediaType?: MediaTypeDto;
  @IsOptional() @IsString() mediaUrl?: string;
  @IsOptional() @IsString() thumbnailUrl?: string;

  @IsOptional() @IsString() executionMethodAr?: string;
  @IsOptional() @IsString() executionMethodEn?: string;
  @IsOptional() @IsString() warningsAr?: string;
  @IsOptional() @IsString() warningsEn?: string;
  @IsOptional() @IsString() commonMistakesAr?: string;
  @IsOptional() @IsString() commonMistakesEn?: string;

  @IsOptional() @IsInt() defaultDurationSeconds?: number;
  @IsOptional() @IsBoolean() active?: boolean;

  @IsOptional() @IsArray() @IsUUID('4', { each: true }) goalIds?: string[];
}

export class ListExercisesQueryDto {
  @IsOptional() @IsUUID() bodyRegionId?: string;
  @IsOptional() @IsUUID() targetRegionId?: string;
  @IsOptional() @IsUUID() subTargetRegionId?: string;
  @IsOptional() @IsUUID() goalId?: string;
  @IsOptional() @IsString() search?: string;
}
