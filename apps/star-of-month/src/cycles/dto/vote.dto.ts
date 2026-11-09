import { IsString, IsNotEmpty } from 'class-validator';

export class CastVoteDto {
  @IsString() @IsNotEmpty() company: string;
  @IsString() @IsNotEmpty() candidateId: string; // employeeId تبع المرشح
}

export class TieBreakDto {
  @IsString() @IsNotEmpty() company: string;
  @IsString() @IsNotEmpty() employeeId: string;
}
