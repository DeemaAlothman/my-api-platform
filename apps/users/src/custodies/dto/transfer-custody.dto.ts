import { IsOptional, IsString, IsDateString } from 'class-validator';

export class TransferCustodyDto {
  @IsString()
  newEmployeeId: string;

  // تاريخ الاستلام من الموظف القديم — افتراضياً الآن
  @IsOptional()
  @IsDateString()
  returnedDate?: string;

  // تاريخ التسليم للموظف الجديد — افتراضياً الآن
  @IsOptional()
  @IsDateString()
  handoverDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
