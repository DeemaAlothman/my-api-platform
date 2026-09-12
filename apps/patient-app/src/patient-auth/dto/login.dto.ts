import { IsString } from 'class-validator';

export class LoginPatientDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}
