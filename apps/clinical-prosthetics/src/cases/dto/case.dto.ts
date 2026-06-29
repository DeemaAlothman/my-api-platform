import {
  IsString, IsOptional, IsBoolean, IsEnum, IsDateString,
  IsInt, Min, Max, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AmputationTypeEnum  { UPPER = 'UPPER', LOWER = 'LOWER' }
export enum AmputationSideEnum  { RIGHT = 'RIGHT', LEFT = 'LEFT', BILATERAL = 'BILATERAL' }
export enum AmputationLevelEnum { PH='PH', WD='WD', TR='TR', ED='ED', TH='TH', SD='SD', PF='PF', CHOPART='CHOPART', TT='TT', KD='KD', TF='TF', HD='HD' }
export enum CaseStatusEnum      { INTAKE='INTAKE', ASSESSMENT='ASSESSMENT', COMMITTEE_REVIEW='COMMITTEE_REVIEW', APPROVED='APPROVED', FITTING='FITTING', SOCKET_TRIAL='SOCKET_TRIAL', GAIT_TRAINING='GAIT_TRAINING', FINAL_REVIEW='FINAL_REVIEW', DELIVERED='DELIVERED', FOLLOW_UP='FOLLOW_UP', CANCELLED='CANCELLED' }
export enum ProsthesisTypeEnum  { BIONIC='BIONIC', MYOBOCK='MYOBOCK', MECHANIC='MECHANIC', COSMETIC_COVER='COSMETIC_COVER', OTHER='OTHER' }

export class CreateCaseDto {
  @IsString()
  patientId: string;

  @IsOptional() @IsDateString()
  amputationDate?: string;

  @IsOptional() @IsString()
  amputationCause?: string;

  @IsOptional() @IsInt() @Min(1) @Max(4) @Type(() => Number)
  amputationCount?: number;

  @IsOptional() @IsEnum(AmputationTypeEnum)
  amputationType?: string;

  @IsOptional() @IsEnum(AmputationSideEnum)
  amputationSide?: string;

  @IsOptional() @IsEnum(AmputationLevelEnum)
  amputationLevel?: string;

  @IsOptional() @IsBoolean()
  hasPreviousProsthesis?: boolean;

  @IsOptional() @IsString()
  previousProsthesisDetails?: string;

  @IsOptional() @IsString()
  previousProsthesisWhen?: string;

  @IsOptional() @IsString()
  previousProsthesisWhere?: string;

  @IsOptional() @IsString()
  previousProsthesisType?: string;

  @IsOptional() @IsBoolean()
  hasRevisionSurgery?: boolean;

  @IsOptional() @IsString()
  revisionDetails?: string;

  @IsOptional() @IsBoolean()
  hasPhysicalTherapy?: boolean;

  @IsOptional() @IsString()
  physicalTherapyDetails?: string;

  @IsOptional() @IsBoolean()
  hasChronicDiseases?: boolean;

  @IsOptional() @IsString()
  chronicDiseases?: string;

  @IsOptional() @IsString()
  prosthetistId?: string;

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsOptional() @IsString()
  supervisingDoctorId?: string;

  @IsOptional() @IsString()
  workshopSupervisorId?: string;

  @IsOptional() @IsEnum(ProsthesisTypeEnum)
  prosthesisType?: string;
}

export class UpdateCaseDto {
  @IsOptional() @IsDateString()
  amputationDate?: string;

  @IsOptional() @IsString()
  amputationCause?: string;

  @IsOptional() @IsInt() @Min(1) @Max(4) @Type(() => Number)
  amputationCount?: number;

  @IsOptional() @IsEnum(AmputationTypeEnum)
  amputationType?: string;

  @IsOptional() @IsEnum(AmputationSideEnum)
  amputationSide?: string;

  @IsOptional() @IsEnum(AmputationLevelEnum)
  amputationLevel?: string;

  @IsOptional() @IsBoolean()
  hasPreviousProsthesis?: boolean;

  @IsOptional() @IsString()
  previousProsthesisDetails?: string;

  @IsOptional() @IsString()
  previousProsthesisWhen?: string;

  @IsOptional() @IsString()
  previousProsthesisWhere?: string;

  @IsOptional() @IsString()
  previousProsthesisType?: string;

  @IsOptional() @IsBoolean()
  hasRevisionSurgery?: boolean;

  @IsOptional() @IsString()
  revisionDetails?: string;

  @IsOptional() @IsBoolean()
  hasPhysicalTherapy?: boolean;

  @IsOptional() @IsString()
  physicalTherapyDetails?: string;

  @IsOptional() @IsBoolean()
  hasChronicDiseases?: boolean;

  @IsOptional() @IsString()
  chronicDiseases?: string;

  @IsOptional() @IsString()
  prosthetistId?: string;

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsOptional() @IsString()
  supervisingDoctorId?: string;

  @IsOptional() @IsString()
  workshopSupervisorId?: string;

  @IsOptional() @IsEnum(ProsthesisTypeEnum)
  prosthesisType?: string;
}

export class UpdateStatusDto {
  @IsEnum(CaseStatusEnum)
  status: string;

  @IsOptional() @IsString()
  note?: string;
}

export class ListCasesQueryDto {
  @IsOptional() @IsString()
  patientId?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  amputationType?: string;

  @IsOptional() @IsString()
  prosthetistId?: string;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  limit?: number = 20;
}
