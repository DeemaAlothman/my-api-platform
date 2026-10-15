import { IsString, IsOptional } from 'class-validator';

export class CreateReceptionDto {
  @IsString()
  patientId: string;

  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianRelation?: string;
  @IsOptional() @IsString() guardianPhone?: string;
}
