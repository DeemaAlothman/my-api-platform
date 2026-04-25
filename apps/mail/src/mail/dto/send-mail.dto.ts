import { IsString, IsArray, IsOptional, IsEnum, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RecipientType {
  TO  = 'TO',
  CC  = 'CC',
  BCC = 'BCC',
}

export class RecipientDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: RecipientType })
  @IsEnum(RecipientType)
  type: RecipientType;
}

export class SendMailDto {
  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  body: string;

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
}
