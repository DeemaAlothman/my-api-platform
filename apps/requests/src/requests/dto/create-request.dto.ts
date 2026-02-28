import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum RequestType {
  TRANSFER = 'TRANSFER',
  PERMISSION = 'PERMISSION',
  ADVANCE = 'ADVANCE',
  RESIGNATION = 'RESIGNATION',
  JOB_CHANGE = 'JOB_CHANGE',
  RIGHTS = 'RIGHTS',
  REWARD = 'REWARD',
  SPONSORSHIP = 'SPONSORSHIP',
  OTHER = 'OTHER',
}

export class CreateRequestDto {
  @IsNotEmpty()
  @IsEnum(RequestType)
  type: RequestType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  details?: Record<string, any>;
}
