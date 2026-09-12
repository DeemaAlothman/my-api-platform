import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  messageText: string;
}

export class ListMessagesQueryDto {
  @IsOptional()
  @IsString()
  after?: string; // ISO timestamp — للـpolling: رسائل بعد هالوقت بس
}
