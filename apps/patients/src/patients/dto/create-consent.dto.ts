import { IsString, IsEnum, IsOptional } from 'class-validator';

export enum ConsentType { DOCUMENTATION = 'DOCUMENTATION', MEDIA_APPEARANCE = 'MEDIA_APPEARANCE' }
export enum ConsentDecision { FUNDER_ONLY = 'FUNDER_ONLY', FUNDER_AND_SOCIAL = 'FUNDER_AND_SOCIAL', REFUSED = 'REFUSED', AGREED = 'AGREED', DISAGREED = 'DISAGREED' }

export class CreateConsentDto {
  @IsEnum(ConsentType) type: ConsentType;
  @IsEnum(ConsentDecision) decision: ConsentDecision;
  @IsString() signedByPatient: string;
  @IsOptional() @IsString() signatureBase64?: string;
  @IsOptional() @IsString() witnessUserId?: string;
}
