import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateJobGradeDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsNotEmpty({ message: 'Arabic name is required' })
  @IsString()
  nameAr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSalary?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
