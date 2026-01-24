import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string>(PERMISSION_KEY, context.getHandler());
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const userPerms: string[] = Array.isArray(req.user?.permissions) ? req.user.permissions : [];

    if (!userPerms.includes(required)) {
      throw new ForbiddenException({
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions',
        details: [{ required, userPermissions: userPerms }],
      });
    }

    return true;
  }
}
