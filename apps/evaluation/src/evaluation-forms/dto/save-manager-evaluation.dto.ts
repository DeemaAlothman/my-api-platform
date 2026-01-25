import {
  IsArray,
  IsString,
  IsOptional,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ManagerSectionScoreDto {
  @IsString()
  criteriaId: string;

  @IsInt()
  @Min(0)
  score: number;

  @IsString()
  @IsOptional()
  comments?: string;
}

export class SaveManagerEvaluationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManagerSectionScoreDto)
  sections: ManagerSectionScoreDto[];

  @IsString()
  @IsOptional()
  comments?: string;

  @IsString()
  @IsOptional()
  strengths?: string;

  @IsString()
  @IsOptional()
  weaknesses?: string;

  @IsString()
  @IsOptional()
  recommendations?: string;
}
