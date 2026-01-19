import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  nameTr?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}
