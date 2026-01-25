import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser } from '../interfaces/user.interface';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
