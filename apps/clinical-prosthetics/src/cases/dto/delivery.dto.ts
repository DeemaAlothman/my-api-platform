import { IsString, IsOptional, IsBoolean, IsArray, IsObject, IsInt, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class FinalEvaluationDto {
  @IsOptional() @IsString()
  residualLimbCondition?: string;

  @IsOptional() @IsString()
  suspensionSystemUsed?: string;

  @IsOptional() @IsInt() @Type(() => Number)
  socksDelivered?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  linersDelivered?: number;

  @IsOptional() @IsDateString()
  fittingDate?: string;

  @IsOptional() @IsString()
  generalNotes?: string;

  @IsString()
  supervisorId: string;

  @IsOptional() @IsString()
  physioOpinion?: string;

  @IsOptional() @IsString()
  departmentHeadOpinion?: string;

  @IsOptional() @IsString()
  prosthetistOpinion?: string;

  @IsOptional() @IsString()
  prosthetistSupervisorOpinion?: string;

  @IsOptional() @IsString()
  committeeHeadOpinion?: string;

  @IsOptional() @IsString()
  expertOpinion?: string;

  @IsOptional() @IsBoolean()
  readyForDelivery?: boolean;

  @IsOptional() @IsBoolean()
  needsFollowUp?: boolean;

  @IsOptional() @IsString()
  followUpPlan?: string;

  @IsOptional() @IsString()
  medicalDirectorNotes?: string;
}

export class DirectorSignDto {
  @IsString()
  signatureBase64: string;

  @IsOptional() @IsString()
  medicalDirectorNotes?: string;

  @IsOptional() @IsString()
  managerNotes?: string;

  @IsOptional() @IsBoolean()
  patientFileComplete?: boolean;
}

export class DeliveryDto {
  @IsDateString()
  deliveryDate: string;

  @IsString()
  prosthetistId: string;

  @IsString()
  physiotherapistId: string;

  @IsArray()
  deliveredItems: any[];

  @IsString()
  managerId: string;
}

export class PatientSignDto {
  @IsString()
  signatureBase64: string;
}

export class ManagerSignDto {
  @IsString()
  signatureBase64: string;
}

export class FollowUpDto {
  @IsDateString()
  visitDate: string;

  @IsString()
  findings: string;

  @IsOptional() @IsString()
  actions?: string;

  @IsString()
  practitionerId: string;
}

export class GaitSignDto {
  @IsString()
  signatureBase64: string;
}
