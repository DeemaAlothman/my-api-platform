import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateJobTitleDto {
  @IsNotEmpty({ message: 'Job title code is required' })
  @IsString()
  code: string;

  @IsNotEmpty({ message: 'Arabic name is required' })
  @IsString()
  nameAr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  nameTr?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  gradeId?: string;
}
