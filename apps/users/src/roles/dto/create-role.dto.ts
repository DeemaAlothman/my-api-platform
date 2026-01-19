import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRoleDto {
  @IsNotEmpty({ message: 'Role name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Arabic display name is required' })
  @IsString()
  displayNameAr: string;

  @IsOptional()
  @IsString()
  displayNameEn?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}
