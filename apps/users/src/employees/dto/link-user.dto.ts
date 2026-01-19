import { IsNotEmpty, IsUUID } from 'class-validator';

export class LinkUserDto {
  @IsNotEmpty({ message: 'User ID is required' })
  @IsUUID()
  userId: string;
}
