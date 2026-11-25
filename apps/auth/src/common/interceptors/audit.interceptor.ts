import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    if (req.method === 'GET') return next.handle();

    // تجديد التوكن عملية تقنية تلقائية بالخلفية، لا فعلٌ لإنسان. سجل التدقيق يجيب
    // «من عمل ماذا»، والتجديد لا يضيف إليه إلا ضجيجاً يغرِق العمليات الحقيقية.
    if (/\/auth\/refresh\/?$/.test(req.path ?? '')) return next.handle();

    // نجاح العملية أو فشلها يُسجَّل صريحاً، لا يُستنتَج من غياب الهوية: محاولة دخول
    // فاشلة وتسجيلُ دخولٍ لم تُحَل هويته إلى اسم يتشابهان بلا هذه العلامة.
    let outcome: 'SUCCESS' | 'FAILED' | null = null;

    return next.handle().pipe(
      tap({
        next: () => { outcome = 'SUCCESS'; },
        error: () => { outcome = 'FAILED'; },
      }),
      finalize(() => {
        const user = req.user;
        const parts = req.path.replace('/api/v1/', '').split('/');
        const resource = parts[0] || null;
        const resourceId = parts[1] && !parts[1].includes('?') ? parts[1] : null;
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

        // التقاط تفاصيل العملية (جسم الطلب) منقّاة من الحقول الحساسة والكبيرة
        let metadata: string | null = null;
        try {
          const clean: Record<string, any> = {};
          const body = req.body;
          if (body && typeof body === 'object' && !Array.isArray(body)) {
            for (const [k, v] of Object.entries(body)) {
              if (/password|token|secret|otp|signature|base64/i.test(k)) continue;
              if (v === null || typeof v === 'number' || typeof v === 'boolean') clean[k] = v;
              else if (typeof v === 'string') clean[k] = v.length > 300 ? v.slice(0, 300) + '…' : v;
              else { try { const s = JSON.stringify(v); if (s.length <= 500) clean[k] = v; } catch { /* skip */ } }
            }
          }
          // يبقى null إن انقطع الطلب قبل أن ينجح أو يفشل، فلا نَنسب نتيجةً لم تحدث
          if (outcome) clean.outcome = outcome;
          if (Object.keys(clean).length) metadata = JSON.stringify(clean);
        } catch { /* ignore */ }

        this.prisma.$executeRaw`
          INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, ip, metadata, "createdAt")
          VALUES (${user?.userId ?? null}, ${user?.username ?? null}, ${req.method + ':' + req.path}, ${resource}, ${resourceId}, ${req.method}, ${req.path}, ${ip}, ${metadata}::jsonb, NOW())
        `.catch(() => {});
      }),
    );
  }
}
