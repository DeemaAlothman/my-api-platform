import { IsArray, IsBoolean, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateReadDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  messageIds: string[];

  @ApiProperty()
  @IsBoolean()
  isRead: boolean;
}

export class UpdateStarDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  messageIds: string[];

  @ApiProperty()
  @IsBoolean()
  isStarred: boolean;
}
