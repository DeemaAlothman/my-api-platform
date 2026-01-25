import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';

export enum GoalStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class UpdateGoalDto {
  @IsString()
  @IsOptional()
  title?: string;

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

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  selfAchievement?: number;

  @IsString()
  @IsOptional()
  selfComments?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  managerAchievement?: number;

  @IsString()
  @IsOptional()
  managerComments?: string;

  @IsEnum(GoalStatus)
  @IsOptional()
  status?: GoalStatus;
}
