import { IsString, IsNotEmpty } from 'class-validator';

export class QuarterTieBreakDto {
  @IsString() @IsNotEmpty() company: string;
  @IsString() @IsNotEmpty() employeeId: string;
}
