import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIDES = new Set(['LEFT', 'RIGHT', 'BILATERAL']);
// آخر جزء من المسار يحدد نوع العملية إن كان فعلاً
const VERB_ACTIONS: Record<string, string> = {
  sign: 'SIGN', 'director-sign': 'SIGN', 'patient-sign': 'SIGN', 'manager-sign': 'SIGN',
  archive: 'ARCHIVE', approve: 'APPROVE', respond: 'RESPOND', save: 'UPDATE',
};
const METHOD_ACTIONS: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
// قيم صغيرة مفيدة للعرض تُنسخ من جسم الطلب (الصنف والكمية…)
const META_KEYS = ['partName', 'partCode', 'quantity', 'consumableName', 'role', 'decision'];
const SENSITIVE = /password|token|secret|otp|signature|base64/i;

/**
 * يسجّل حدثاً بجدول case_events بعد نجاح أي عملية كتابة على حالة أطراف (وتصدير PDF).
 * لا يغيّر الطلب ولا الرد، وفشل التسجيل لا يؤثر على العملية.
 */
@Injectable()
export class CaseEventsInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const isPdf = req.method === 'GET' && /\/prosthetics\/cases\/[^/]+\/pdf$/.test(req.path);
    if (req.method === 'GET' && !isPdf) return next.handle();

    return next.handle().pipe(
      tap({ next: (result) => { this.record(req, result, isPdf).catch(() => {}); } }),
    );
  }

  private async record(req: any, result: any, isPdf: boolean) {
    const rest = String(req.path).split('/prosthetics/cases')[1]?.split('/').filter(Boolean) ?? [];

    let caseId: string | undefined;
    let segs: string[];
    if (rest.length === 0) {
      if (req.method !== 'POST') return;
      caseId = result?.id;               // إنشاء حالة
      segs = [];
    } else {
      caseId = rest[0];
      segs = rest.slice(1);
    }
    if (!caseId || !UUID_RE.test(caseId)) return;   // مسارات بدون رقم حالة (internal / sessions/...)
    if (segs[0] === 'status') return;               // تغيير المرحلة مسجّل بتاريخ المراحل

    const parts: string[] = [];
    const metadata: Record<string, any> = {};
    for (const s of segs) {
      if (UUID_RE.test(s)) metadata.subId = s;
      else if (SIDES.has(s.toUpperCase())) metadata.side = s.toUpperCase();
      else parts.push(s);
    }

    const last = parts[parts.length - 1];
    let type: string;
    let action: string;
    if (isPdf) {
      type = 'CASE_PDF';
      action = 'EXPORT';
    } else if (parts.length === 0) {
      type = req.method === 'POST' ? 'CASE_CREATED' : 'CASE_UPDATED';
      action = METHOD_ACTIONS[req.method] ?? req.method;
    } else {
      type = parts.join('_').replace(/-/g, '_').toUpperCase();
      action = VERB_ACTIONS[last] ?? METHOD_ACTIONS[req.method] ?? req.method;
    }

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const fields = Object.keys(body).filter((k) => !SENSITIVE.test(k));
    for (const k of META_KEYS) {
      const v = body[k];
      if (v !== undefined && (typeof v !== 'string' || v.length <= 200)) metadata[k] = v;
    }
    if (Array.isArray(req.body)) metadata.count = req.body.length;
    if (Array.isArray(body.items)) metadata.count = body.items.length;

    const c = await this.prisma.prostheticsCase.findUnique({ where: { id: caseId }, select: { status: true } });
    if (!c) return;

    await this.prisma.caseEvent.create({
      data: {
        caseId, type, action,
        stage: c.status as string,
        actorId: req.user?.userId ?? null,
        method: req.method,
        path: req.path,
        fields,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      },
    });
  }
}
