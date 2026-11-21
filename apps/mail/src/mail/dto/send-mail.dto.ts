import { IsString, IsArray, IsOptional, IsEnum, IsIn, ArrayMinSize, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RecipientType {
  TO  = 'TO',
  CC  = 'CC',
  BCC = 'BCC',
}

export class RecipientDto {
  @ApiProperty({ description: 'Employee ID of the recipient' })
  @IsString()
  employeeId: string;

  @ApiProperty({ enum: RecipientType })
  @IsEnum(RecipientType)
  type: RecipientType;
}

export class SendMailDto {
  @ApiProperty()
  @IsString()
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiProperty({ type: [RecipientDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];

  @ApiPropertyOptional({ type: [String], description: 'Department IDs to expand to user IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentMessageId?: string;

  // LOW أُضيفت للأهمية المنخفضة. @IsIn يرفض قيمة غير معروفة بـ400 بدل تخزينها
  // كما هي ثم ظهورها خاماً في الواجهة.
  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH'], default: 'NORMAL' })
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  importance?: string;

  @ApiPropertyOptional({ enum: ['REPLY', 'REPLY_ALL', 'FORWARD'] })
  @IsOptional()
  @IsIn(['REPLY', 'REPLY_ALL', 'FORWARD'])
  replyType?: string;

  @ApiPropertyOptional({ type: [String], description: 'IDs of pre-uploaded orphan attachments to link to this message' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}
