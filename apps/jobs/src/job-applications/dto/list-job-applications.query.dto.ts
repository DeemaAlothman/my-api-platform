import { IsOptional, IsString, IsNumberString, IsIn } from 'class-validator';

export class ListJobApplicationsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  /** true = قائمة المواهب فقط */
  @IsOptional()
  @IsIn(['true', 'false'])
  isTalent?: string;
}
