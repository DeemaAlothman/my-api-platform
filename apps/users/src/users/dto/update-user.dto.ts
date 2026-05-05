import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password?: string;
}
