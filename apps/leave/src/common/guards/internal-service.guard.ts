import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers['x-internal-token'];
    if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException({ code: 'INTERNAL_AUTH_INVALID', message: 'Invalid internal token' });
    }
    return true;
  }
}
