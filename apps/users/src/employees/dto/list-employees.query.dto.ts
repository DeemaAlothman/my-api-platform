import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { EmploymentStatus } from './update-employee.dto';

export class ListEmployeesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  // true = الخارجيون فقط، false = الداخليون فقط، غير مُرسَل = الكل.
  // لا بد من تعريفه هنا: الخدمة تعمل بـwhitelist فأي باراميتر غير معرَّف يُحذف
  // بصمت ويعود الرد ناجحاً بلا فلترة.
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : value === 'true' || value === true))
  @IsBoolean()
  isExternal?: boolean;

  @IsOptional()
  @IsUUID()
  externalTypeId?: string;
}
