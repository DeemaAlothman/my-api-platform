import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class UpdateSalesCommissionDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  salesReference?: string;
}
