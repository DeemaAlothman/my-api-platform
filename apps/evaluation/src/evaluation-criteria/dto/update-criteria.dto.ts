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
import { CriteriaCategory } from './create-criteria.dto';

export class UpdateCriteriaDto {
  @IsString()
  @IsOptional()
  nameAr?: string;

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
  @IsOptional()
  category?: CriteriaCategory;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  displayOrder?: number;
}
