import {
  IsArray,
  IsString,
  IsOptional,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SectionScoreDto {
  @IsString()
  criteriaId: string;

  @IsInt()
  @Min(0)
  score: number;

  @IsString()
  @IsOptional()
  comments?: string;
}

export class SaveSelfEvaluationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionScoreDto)
  sections: SectionScoreDto[];

  @IsString()
  @IsOptional()
  comments?: string;
}
