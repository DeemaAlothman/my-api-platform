import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum RequestType {
  TRANSFER = 'TRANSFER',
  RESIGNATION = 'RESIGNATION',
  REWARD = 'REWARD',
  OTHER = 'OTHER',
  PENALTY_PROPOSAL = 'PENALTY_PROPOSAL',
  OVERTIME_EMPLOYEE = 'OVERTIME_EMPLOYEE',
  OVERTIME_MANAGER = 'OVERTIME_MANAGER',
  BUSINESS_MISSION = 'BUSINESS_MISSION',
  DELEGATION = 'DELEGATION',
  HIRING_REQUEST = 'HIRING_REQUEST',
  COMPLAINT = 'COMPLAINT',
  WORK_ACCIDENT = 'WORK_ACCIDENT',
  REMOTE_WORK = 'REMOTE_WORK',
}

export class CreateRequestDto {
  @IsNotEmpty()
  @IsEnum(RequestType)
  type: RequestType;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  details?: Record<string, any>;
}
