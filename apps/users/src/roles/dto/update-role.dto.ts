import { IsOptional, IsString } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  displayNameAr?: string;

  @IsOptional()
  @IsString()
  displayNameEn?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
