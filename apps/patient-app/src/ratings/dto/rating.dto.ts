import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsOptional()
  @IsString()
  privateNote?: string;
}

export class ListRatingsQueryDto {
  @IsOptional() @IsString() erpTherapistId?: string;
  @IsOptional() @IsString() erpPatientId?: string;
}
