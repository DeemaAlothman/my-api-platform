import { IsString, IsEnum, IsOptional, IsDateString, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum DocumentType { CONTRACT = 'CONTRACT', NATIONAL_ID = 'NATIONAL_ID', PASSPORT = 'PASSPORT', RESIDENCE = 'RESIDENCE', CERTIFICATE = 'CERTIFICATE', PHOTO = 'PHOTO', MEDICAL = 'MEDICAL', BANK_ACCOUNT = 'BANK_ACCOUNT', OTHER = 'OTHER' }

export class CreateDocumentDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiProperty({ enum: DocumentType }) @IsEnum(DocumentType) type: DocumentType;
  @ApiProperty() @IsString() titleAr: string;
  @ApiPropertyOptional() @IsOptional() @IsString() titleEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() issueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
}
