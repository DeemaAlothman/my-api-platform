import { IsString, IsOptional } from 'class-validator';

export class UpdateReceptionDto {
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianRelation?: string;
  @IsOptional() @IsString() guardianPhone?: string;
}
