import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateEvaluationFormDto {
  @IsString()
  @IsNotEmpty()
  periodId: string;

  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsOptional()
  evaluatorId?: string;
}
