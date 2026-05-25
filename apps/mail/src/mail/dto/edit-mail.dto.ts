import { IsOptional, IsString, MinLength } from 'class-validator';

export class EditMailDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;
}
