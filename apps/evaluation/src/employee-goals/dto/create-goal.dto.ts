import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreateGoalDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  targetDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  weight?: number;
}
