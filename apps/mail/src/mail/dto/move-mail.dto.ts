import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MailFolder {
  INBOX   = 'INBOX',
  SENT    = 'SENT',
  DRAFTS  = 'DRAFTS',
  ARCHIVE = 'ARCHIVE',
  TRASH   = 'TRASH',
}

export class MoveMailDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  messageIds: string[];

  @ApiProperty({ enum: MailFolder })
  @IsEnum(MailFolder)
  folder: MailFolder;

  @ApiPropertyOptional({ description: 'Archive folder ID — used only when folder is ARCHIVE' })
  @IsOptional()
  @IsString()
  archiveFolderId?: string;
}
