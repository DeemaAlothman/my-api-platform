import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Interceptor to automatically resolve employeeId from userId in JWT
 * Attaches employeeId to the request when found; leaves it null otherwise.
 * Endpoints that require an employeeId (e.g. check-in) should validate it themselves.
 */
@Injectable()
export class EmployeeInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const username = request.user?.username;

    if (username) {
      const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT e.id
        FROM users.employees e
        INNER JOIN users.users u ON e."userId" = u.id
        WHERE u.username = ${username}
        LIMIT 1
      `;

      request.employeeId = result && result.length > 0 ? result[0].id : null;
    }

    return next.handle();
  }
}
