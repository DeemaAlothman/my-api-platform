import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  // الموارد التي يملكها هذا الخدمة ومساراتها مسطَّحة، أي أن الجزء الثاني من المسار
  // هو معرِّف السجل نفسه لا قطعةٌ ثابتة منه
  private readonly TARGETS: Record<string, { table: string; nameSql: string }> = {
    users:       { table: 'users.users',       nameSql: `COALESCE(NULLIF(TRIM("fullName"), ''), username)` },
    employees:   { table: 'users.employees',   nameSql: `TRIM(COALESCE("firstNameAr",'') || ' ' || COALESCE("lastNameAr",''))` },
    departments: { table: 'users.departments', nameSql: `"nameAr"` },
    roles:       { table: 'users.roles',       nameSql: `COALESCE("displayNameAr", name)` },
  };

  // يُحَلُّ الاسم قبل تنفيذ العملية لا بعدها. الحذفُ يُسقِط السجلَّ من جدوله، فلو
  // أُجِّل الحلُّ إلى ما بعد التنفيذ لبقي أهمُّ ما يُدقَّق — من حُذف بالضبط — بلا اسم.
  private async resolveTargetName(
    resource: string | null,
    resourceId: string | null,
  ): Promise<string | null> {
    if (!resource || !resourceId) return null;
    const cfg = this.TARGETS[resource];
    if (!cfg) return null;
    // قطعةٌ ثابتة من المسار («assign» مثلاً) ليست معرِّفاً، فلا تُستعلَم
    if (!/^[0-9a-fA-F-]{8,}$/.test(resourceId)) return null;
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ name: string | null }>>(
        `SELECT ${cfg.nameSql} AS name FROM ${cfg.table} WHERE id::text = $1 LIMIT 1`,
        resourceId,
      );
      const name = rows[0]?.name?.trim();
      return name ? name : null;
    } catch {
      return null;
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    if (req.method === 'GET') return next.handle();

    const parts = req.path.replace('/api/v1/', '').split('/');
    const resource = parts[0] || null;
    const resourceId = parts[1] && !parts[1].includes('?') ? parts[1] : null;

    // يبدأ الحلُّ الآن ويُنتظَر بعد انتهاء العملية: لا يُؤخِّر الطلبَ، ويُقرأ السجلُّ
    // وهو ما يزال قائماً
    const targetNamePromise = this.resolveTargetName(resource, resourceId);

    return next.handle().pipe(
      finalize(() => {
        const user = req.user;
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

        targetNamePromise
          .catch(() => null)
          .then((targetName) => this.prisma.$executeRaw`
            INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, ip, metadata, "targetName", "createdAt")
            VALUES (${user?.userId ?? null}, ${user?.username ?? null}, ${req.method + ':' + req.path}, ${resource}, ${resourceId}, ${req.method}, ${req.path}, ${ip}, ${metadata}::jsonb, ${targetName}, NOW())
          `)
          .catch(() => {});
      }),
    );
  }
}
