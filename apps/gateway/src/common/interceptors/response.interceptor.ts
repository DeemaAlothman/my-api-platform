import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => {
        // إذا البيانات جاية من proxy، ما نغلّفها مرة ثانية
        if (data && typeof data === 'object' && ('success' in data || 'error' in data)) {
          return data;
        }

        // غلاف موحد للـ responses
        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.headers['x-request-id'],
          },
        };
      }),
    );
  }
}
