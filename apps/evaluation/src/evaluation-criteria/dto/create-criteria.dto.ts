import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export enum CriteriaCategory {
  PERFORMANCE = 'PERFORMANCE',
  BEHAVIOR = 'BEHAVIOR',
  SKILLS = 'SKILLS',
  ACHIEVEMENT = 'ACHIEVEMENT',
  DEVELOPMENT = 'DEVELOPMENT',
}

export class CreateCriteriaDto {
  @IsString()
  code: string;

  @IsString()
  nameAr: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsString()
  @IsOptional()
  descriptionAr?: string;

  @IsString()
  @IsOptional()
  descriptionEn?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  weight?: number;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxScore?: number;

  @IsEnum(CriteriaCategory)
  category: CriteriaCategory;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  displayOrder?: number;
}
