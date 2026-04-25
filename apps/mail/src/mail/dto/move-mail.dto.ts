import { IsArray, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
