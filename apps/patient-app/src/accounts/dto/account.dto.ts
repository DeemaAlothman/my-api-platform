import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateAccountDto {
  @IsUUID() erpPatientId: string;
  @IsString() @MinLength(3) username: string;
  @IsString() @MinLength(6) password: string;
}

export class UpdateAccountDto {
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE', 'BLOCKED']) status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  @IsOptional() @IsString() @MinLength(6) password?: string;
}
