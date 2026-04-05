import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    if (req.method === 'GET') return next.handle();

    return next.handle().pipe(
      tap(() => {
        const user = req.user;
        const parts = req.path.replace('/api/v1/', '').split('/');
        const resource = parts[0] || null;
        const resourceId = parts[1] && !parts[1].includes('?') ? parts[1] : null;
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

        pool.query(
          `INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, ip, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [user?.userId ?? null, user?.username ?? null, req.method + ':' + req.path, resource, resourceId, req.method, req.path, ip],
        ).catch(() => {});
      }),
    );
  }
}
