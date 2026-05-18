import { IsString, IsInt, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class CreateSalesCommissionDto {
  @IsString()
  employeeId: string;

  @IsInt()
  @Min(2020)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  salesReference?: string;
}
