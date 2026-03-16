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
  PENALTY_PROPOSAL = 'PENALTY_PROPOSAL',
  OVERTIME_EMPLOYEE = 'OVERTIME_EMPLOYEE',
  OVERTIME_MANAGER = 'OVERTIME_MANAGER',
  BUSINESS_MISSION = 'BUSINESS_MISSION',
  DELEGATION = 'DELEGATION',
  HIRING_REQUEST = 'HIRING_REQUEST',
  COMPLAINT = 'COMPLAINT',
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
