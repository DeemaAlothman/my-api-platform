import {
  IsString, IsOptional, IsEnum, IsDateString, IsInt, Min, IsNumber, IsArray,
  IsNotEmpty, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AppointmentTypeEnum {
  ASSESSMENT   = 'ASSESSMENT',
  FITTING      = 'FITTING',
  SESSION      = 'SESSION',
  FOLLOW_UP    = 'FOLLOW_UP',
  COMMITTEE    = 'COMMITTEE',
  EXAMINATION  = 'EXAMINATION',
}

export enum PractitionerRoleEnum {
  PHYSIOTHERAPIST = 'PHYSIOTHERAPIST',
  PROSTHETIST     = 'PROSTHETIST',
  DOCTOR          = 'DOCTOR',
  TECHNICIAN      = 'TECHNICIAN',
}

export enum CaseTypeEnum          { PROSTHETICS='PROSTHETICS', PHYSIO='PHYSIO', GENERAL='GENERAL' }
export enum AppointmentStatusEnum { SCHEDULED='SCHEDULED', CONFIRMED='CONFIRMED', COMPLETED='COMPLETED', CANCELLED='CANCELLED', NO_SHOW='NO_SHOW', RESCHEDULED='RESCHEDULED' }

export class CreateAppointmentDto {
  @IsOptional() @IsString()
  patientId?: string;

  @ValidateIf(o => !o.patientId)
  @IsString() @IsNotEmpty()
  patientName?: string;

  @IsOptional() @IsString()
  caseId?: string;

  @IsOptional() @IsEnum(CaseTypeEnum)
  caseType?: string;

  @IsString()
  practitionerId: string;

  @IsOptional() @IsEnum(PractitionerRoleEnum)
  practitionerRole?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsEnum(AppointmentTypeEnum)
  appointmentType: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  durationMinutes?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  therapistIds?: string[];

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateAppointmentDto {
  @IsOptional() @IsDateString()
  startTime?: string;

  @IsOptional() @IsDateString()
  endTime?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsEnum(AppointmentTypeEnum)
  appointmentType?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @IsString()
  physiotherapistId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  therapistIds?: string[];
}

export class UpdateStatusDto {
  @IsEnum(AppointmentStatusEnum)
  status: string;

  @IsOptional() @IsString()
  cancelledReason?: string;
}

export class RescheduleDto {
  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class ListAppointmentsQueryDto {
  @IsOptional() @IsString()
  patientId?: string;

  @IsOptional() @IsString()
  practitionerId?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  date?: string;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  limit?: number = 50;
}

export class CalendarQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional() @IsString()
  practitionerId?: string;
}

export class SlotsQueryDto {
  @IsDateString()
  date: string;

  @IsOptional() @IsInt() @Min(15) @Type(() => Number)
  slotDurationMinutes?: number = 60;
}

export class PractitionerPatientsQueryDto {
  @IsOptional() @IsString()
  practitionerId?: string;
}

export class MyAppointmentsQueryDto {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  date?: string;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  limit?: number = 50;
}
