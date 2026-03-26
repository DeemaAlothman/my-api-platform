import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { CustodyStatus } from './custody.enums';

export class ReturnCustodyDto {
  @IsOptional()
  @IsDateString()
  returnedDate?: string;

  @IsEnum(CustodyStatus)
  status: CustodyStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
