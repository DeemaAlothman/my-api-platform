import { IsString, IsOptional, IsDateString, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustodyCategory } from './custody.enums';
import { CustodyAttachmentDto } from './create-custody.dto';

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustodyAttachmentDto)
  attachments?: CustodyAttachmentDto[];
}
