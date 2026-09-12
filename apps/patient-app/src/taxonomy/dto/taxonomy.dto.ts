import { IsBoolean, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBodyRegionDto {
  @IsString() nameAr: string;
  @IsString() nameEn: string;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateBodyRegionDto {
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateTargetRegionDto {
  @IsUUID() bodyRegionId: string;
  @IsString() nameAr: string;
  @IsString() nameEn: string;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateTargetRegionDto {
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateSubTargetRegionDto {
  @IsUUID() targetRegionId: string;
  @IsString() nameAr: string;
  @IsString() nameEn: string;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateSubTargetRegionDto {
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateExerciseGoalDto {
  @IsString() nameAr: string;
  @IsString() nameEn: string;
}
export class UpdateExerciseGoalDto {
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
