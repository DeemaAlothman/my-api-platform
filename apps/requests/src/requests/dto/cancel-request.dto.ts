import { IsNotEmpty, IsString } from 'class-validator';

export class CancelRequestDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}
