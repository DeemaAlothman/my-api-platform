import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @IsNotEmpty({ message: 'Department code is required' })
  @IsString()
  code: string;

  @IsNotEmpty({ message: 'Arabic name is required' })
  @IsString()
  nameAr: string;

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
