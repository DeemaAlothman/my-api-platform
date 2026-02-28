import { IsOptional, IsString } from 'class-validator';

export class ApproveRequestDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
