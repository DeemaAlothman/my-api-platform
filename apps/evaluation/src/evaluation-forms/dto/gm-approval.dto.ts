import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum ApprovalStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVISION = 'NEEDS_REVISION',
}

export class GMApprovalDto {
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @IsString()
  @IsOptional()
  comments?: string;
}
