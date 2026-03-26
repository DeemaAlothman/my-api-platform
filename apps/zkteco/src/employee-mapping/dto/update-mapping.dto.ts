import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateMappingDto {
  @IsOptional()
  @IsString()
  pin?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
