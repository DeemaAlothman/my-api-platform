import { IsOptional, IsString } from 'class-validator';

export class UpsertReviewDto {
  @IsOptional() @IsString() notes?: string;
}
