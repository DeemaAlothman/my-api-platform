import { IsEnum, IsString, IsOptional, IsBoolean } from 'class-validator';

export enum PeerRating {
  EXCELLENT = 'EXCELLENT',
  VERY_GOOD = 'VERY_GOOD',
  GOOD = 'GOOD',
  SATISFACTORY = 'SATISFACTORY',
  NEEDS_IMPROVEMENT = 'NEEDS_IMPROVEMENT',
}

export class CreatePeerEvaluationDto {
  @IsEnum(PeerRating)
  rating: PeerRating;

  @IsString()
  @IsOptional()
  strengths?: string;

  @IsString()
  @IsOptional()
  improvements?: string;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;
}
