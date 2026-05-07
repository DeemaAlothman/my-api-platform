import { SetMetadata, applyDecorators } from '@nestjs/common';
import { PermissionName } from '../constants/permissions.constants';

export const PERMISSION_KEY = 'permission';
export const PERMISSION_MODE_KEY = 'permission_mode';

/** Require at least one of the given permissions (OR logic — default) */
export const Permission = (...permissions: PermissionName[]) =>
  SetMetadata(PERMISSION_KEY, permissions.length === 1 ? permissions[0] : permissions);

/** Require at least one of the given permissions (explicit OR) */
export const RequireAnyPermission = (...permissions: PermissionName[]) =>
  applyDecorators(
    SetMetadata(PERMISSION_KEY, permissions),
    SetMetadata(PERMISSION_MODE_KEY, 'any'),
  );

/** Require ALL of the given permissions (AND logic) */
export const RequireAllPermissions = (...permissions: PermissionName[]) =>
  applyDecorators(
    SetMetadata(PERMISSION_KEY, permissions),
    SetMetadata(PERMISSION_MODE_KEY, 'all'),
  );
