import { IsString, IsNotEmpty } from 'class-validator';

export class AddHrNomineeDto {
  @IsString() @IsNotEmpty() company: string;
  @IsString() @IsNotEmpty() employeeId: string;
}
