import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-internal-token'];
    const expected = process.env.INTERNAL_SERVICE_TOKEN;

    // فشل مغلق: إن لم يُضبط التوكن في البيئة، امنع التشغيل بالكامل.
    if (!expected) {
      throw new InternalServerErrorException('INTERNAL_SERVICE_TOKEN not configured');
    }
    if (token !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }

    return true;
  }
}
