import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum CommitteeRoleEnum {
  PROSTHETIST = 'PROSTHETIST',
  PHYSIOTHERAPIST = 'PHYSIOTHERAPIST',
  DOCTOR = 'DOCTOR',
  COMMITTEE_HEAD = 'COMMITTEE_HEAD',
  EXPERT = 'EXPERT',
}

export class CommitteeOpinionDto {
  @IsEnum(CommitteeRoleEnum)
  role: string;

  @IsString()
  opinion: string;
}

export class CommitteeDecideDto {
  @IsString()
  decision: string;

  @IsOptional() @IsString()
  finalSummary?: string;
}

export class CommitteeSignDto {
  @IsString()
  signatureBase64: string;
}
