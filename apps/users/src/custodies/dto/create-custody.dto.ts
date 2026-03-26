import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { CustodyCategory } from './custody.enums';

export class CreateCustodyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsEnum(CustodyCategory)
  category?: CustodyCategory;

  @IsString()
  employeeId: string;

  @IsDateString()
  assignedDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
