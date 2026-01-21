import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get employee ID from the request
 * The employeeId is attached to the request by the EmployeeInterceptor
 */
export const EmployeeId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.employeeId;
  },
);

/**
 * Decorator to get user ID from the JWT token
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId;
  },
);
