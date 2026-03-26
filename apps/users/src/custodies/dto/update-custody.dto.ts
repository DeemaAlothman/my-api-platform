import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { CustodyCategory } from './custody.enums';

export class UpdateCustodyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsEnum(CustodyCategory)
  category?: CustodyCategory;

  @IsOptional()
  @IsDateString()
  assignedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
