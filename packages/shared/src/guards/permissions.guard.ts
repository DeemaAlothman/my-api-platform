import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, PERMISSION_MODE_KEY } from '../decorators/permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string | string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) return true;

    const mode = this.reflector.getAllAndOverride<'any' | 'all'>(
      PERMISSION_MODE_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? 'any';

    const request = context.switchToHttp().getRequest();
    const userPermissions: string[] = request.user?.permissions || [];

    const permissions = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    const hasPermission = mode === 'all'
      ? permissions.every(p => userPermissions.includes(p))
      : permissions.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      throw new ForbiddenException({
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        message: 'ليس لديك الصلاحية الكافية لهذا الإجراء',
        details: {
          required: permissions,
          mode,
          granted: userPermissions,
        },
      });
    }

    return true;
  }
}
