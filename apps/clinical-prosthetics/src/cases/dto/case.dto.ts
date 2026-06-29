import {
  IsString, IsOptional, IsBoolean, IsEnum, IsDateString,
  IsInt, Min, Max, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AmputationTypeEnum  { UPPER = 'UPPER', LOWER = 'LOWER' }
export enum AmputationSideEnum  { RIGHT = 'RIGHT', LEFT = 'LEFT', BILATERAL = 'BILATERAL' }
export enum AmputationCauseEnum {
  WAR_INJURY = 'WAR_INJURY',
  TRAFFIC_ACCIDENT = 'TRAFFIC_ACCIDENT',
  DIABETES = 'DIABETES',
  VASCULAR_DISEASE = 'VASCULAR_DISEASE',
  CONGENITAL = 'CONGENITAL',
  INFECTION = 'INFECTION',
  TUMOR = 'TUMOR',
  WORK_INJURY = 'WORK_INJURY',
  OTHER = 'OTHER',
}
export enum AmputationLevelEnum { PH='PH', WD='WD', TR='TR', ED='ED', TH='TH', SD='SD', PF='PF', CHOPART='CHOPART', TT='TT', KD='KD', TF='TF', HD='HD' }
export enum CaseStatusEnum      { INTAKE='INTAKE', ASSESSMENT='ASSESSMENT', COMMITTEE_REVIEW='COMMITTEE_REVIEW', APPROVED='APPROVED', FITTING='FITTING', SOCKET_TRIAL='SOCKET_TRIAL', GAIT_TRAINING='GAIT_TRAINING', FINAL_REVIEW='FINAL_REVIEW', DELIVERED='DELIVERED', FOLLOW_UP='FOLLOW_UP', CANCELLED='CANCELLED' }
export enum ProsthesisTypeEnum  { BIONIC='BIONIC', MYOBOCK='MYOBOCK', MECHANIC='MECHANIC', COSMETIC_COVER='COSMETIC_COVER', OTHER='OTHER' }

export class CreateCaseDto {
  @IsString()
  patientId: string;

  @IsOptional() @IsDateString()
  amputationDate?: string;

  @IsOptional() @IsEnum(AmputationCauseEnum)
  amputationCause?: string;

  // يُعبّى فقط إذا amputationCause = OTHER
  @IsOptional() @IsString()
  amputationCauseOtherDetail?: string;

  @IsOptional() @IsInt() @Min(1) @Max(4) @Type(() => Number)
  amputationCount?: number;

  @IsOptional() @IsEnum(AmputationTypeEnum)
  amputationType?: string;

  @IsOptional() @IsEnum(AmputationSideEnum)
  amputationSide?: string;

  @IsOptional() @IsEnum(AmputationLevelEnum)
  amputationLevel?: string;

  // الجانب الأكثر تأثراً والذي يجري رصده وعلاجه — فقط عند amputationSide = BILATERAL (RIGHT أو LEFT)
  @IsOptional() @IsEnum(AmputationSideEnum)
  moreAffectedSide?: string;

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

  // من استمارة التقييم السريري — سؤال واحد للحالة، لا يتكرر حسب الطرف
  @IsOptional() @IsBoolean()
  currentlyUsingProsthesis?: boolean;

  @IsOptional() @IsBoolean()
  previouslyUsedProsthesis?: boolean;

  // يُعبّى فقط إذا previouslyUsedProsthesis = true
  @IsOptional() @IsString()
  previousProsthesisSystemDetail?: string;

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

  @IsOptional() @IsEnum(AmputationCauseEnum)
  amputationCause?: string;

  // يُعبّى فقط إذا amputationCause = OTHER
  @IsOptional() @IsString()
  amputationCauseOtherDetail?: string;

  @IsOptional() @IsInt() @Min(1) @Max(4) @Type(() => Number)
  amputationCount?: number;

  @IsOptional() @IsEnum(AmputationTypeEnum)
  amputationType?: string;

  @IsOptional() @IsEnum(AmputationSideEnum)
  amputationSide?: string;

  @IsOptional() @IsEnum(AmputationLevelEnum)
  amputationLevel?: string;

  // الجانب الأكثر تأثراً والذي يجري رصده وعلاجه — فقط عند amputationSide = BILATERAL (RIGHT أو LEFT)
  @IsOptional() @IsEnum(AmputationSideEnum)
  moreAffectedSide?: string;

  // من استمارة التقييم السريري — سؤال واحد للحالة، لا يتكرر حسب الطرف
  @IsOptional() @IsBoolean()
  currentlyUsingProsthesis?: boolean;

  @IsOptional() @IsBoolean()
  previouslyUsedProsthesis?: boolean;

  // يُعبّى فقط إذا previouslyUsedProsthesis = true
  @IsOptional() @IsString()
  previousProsthesisSystemDetail?: string;

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
