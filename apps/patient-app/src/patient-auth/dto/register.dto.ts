import { IsString, MinLength, Matches } from 'class-validator';

export class RegisterPatientDto {
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'رقم الهاتف غير صالح' })
  phone: string;

  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}
