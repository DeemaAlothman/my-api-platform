import { IsOptional, IsString } from 'class-validator';

export class UpsertDoctorDecisionDto {
  @IsOptional() @IsString() decision?: string;
}
