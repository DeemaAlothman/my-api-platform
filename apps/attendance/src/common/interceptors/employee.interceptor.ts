import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Interceptor to automatically resolve employeeId from userId in JWT
 * This runs before every request and attaches employeeId to the request object
 */
@Injectable()
export class EmployeeInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (userId) {
      // Query the users schema to find the employee record
      const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM users.employees WHERE "userId" = ${userId}::text LIMIT 1
      `;

      if (result && result.length > 0) {
        // Attach employeeId to the request for use in controllers
        request.employeeId = result[0].id;
      } else {
        // User exists but has no employee record
        throw new NotFoundException(
          'Employee record not found. Please contact HR to create your employee profile.',
        );
      }
    }

    return next.handle();
  }
}
