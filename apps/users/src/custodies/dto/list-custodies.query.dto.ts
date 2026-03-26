import { IsOptional, IsInt, IsEnum, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CustodyStatus, CustodyCategory } from './custody.enums';

export class ListCustodiesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(CustodyStatus)
  status?: CustodyStatus;

  @IsOptional()
  @IsEnum(CustodyCategory)
  category?: CustodyCategory;

  @IsOptional()
  @IsString()
  search?: string;
}
