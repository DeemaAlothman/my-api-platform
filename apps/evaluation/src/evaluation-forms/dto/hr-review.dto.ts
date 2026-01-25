import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum HRRecommendation {
  PROMOTION = 'PROMOTION',
  SALARY_INCREASE = 'SALARY_INCREASE',
  BONUS = 'BONUS',
  TRAINING = 'TRAINING',
  WARNING = 'WARNING',
  TERMINATION = 'TERMINATION',
  NO_ACTION = 'NO_ACTION',
}

export class HRReviewDto {
  @IsEnum(HRRecommendation)
  recommendation: HRRecommendation;

  @IsString()
  @IsOptional()
  comments?: string;
}
