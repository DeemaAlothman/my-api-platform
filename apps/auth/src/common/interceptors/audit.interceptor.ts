import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    if (req.method === 'GET') return next.handle();

    return next.handle().pipe(
      finalize(() => {
        const user = req.user;
        const parts = req.path.replace('/api/v1/', '').split('/');
        const resource = parts[0] || null;
        const resourceId = parts[1] && !parts[1].includes('?') ? parts[1] : null;
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

        // التقاط تفاصيل العملية (جسم الطلب) منقّاة من الحقول الحساسة والكبيرة
        let metadata: string | null = null;
        try {
          const body = req.body;
          if (body && typeof body === 'object' && !Array.isArray(body)) {
            const clean: Record<string, any> = {};
            for (const [k, v] of Object.entries(body)) {
              if (/password|token|secret|otp|signature|base64/i.test(k)) continue;
              if (v === null || typeof v === 'number' || typeof v === 'boolean') clean[k] = v;
              else if (typeof v === 'string') clean[k] = v.length > 300 ? v.slice(0, 300) + '…' : v;
              else { try { const s = JSON.stringify(v); if (s.length <= 500) clean[k] = v; } catch { /* skip */ } }
            }
            if (Object.keys(clean).length) metadata = JSON.stringify(clean);
          }
        } catch { /* ignore */ }

        this.prisma.$executeRaw`
          INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, ip, metadata, "createdAt")
          VALUES (${user?.userId ?? null}, ${user?.username ?? null}, ${req.method + ':' + req.path}, ${resource}, ${resourceId}, ${req.method}, ${req.path}, ${ip}, ${metadata}::jsonb, NOW())
        `.catch(() => {});
      }),
    );
  }
}
