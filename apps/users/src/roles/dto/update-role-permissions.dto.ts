import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsNotEmpty({ message: 'Permission IDs are required' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  permissionIds: string[];
}
