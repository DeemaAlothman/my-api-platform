import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignRolesDto {
  @IsNotEmpty({ message: 'Role IDs are required' })
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds: string[];
}
