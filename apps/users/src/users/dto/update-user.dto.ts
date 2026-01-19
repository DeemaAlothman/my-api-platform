import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus } from './list-users.query.dto';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(UserStatus, { message: 'Status must be ACTIVE or INACTIVE' })
  status?: UserStatus;
}
