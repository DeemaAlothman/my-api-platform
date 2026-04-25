import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustodyCategory } from './custody.enums';

export class CustodyAttachmentDto {
  @IsString()
  fileUrl: string;

  @IsString()
  fileName: string;
}

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustodyAttachmentDto)
  attachments?: CustodyAttachmentDto[];
}
