import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-internal-token'];
    const expected = process.env.INTERNAL_SERVICE_TOKEN;

    if (expected && token !== expected) {
      throw new UnauthorizedException('Invalid internal service token');
    }

    return true;
  }
}
